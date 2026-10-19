import { GetItemCommand, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { dynamoClient, USERS_TABLE } from '../db/dynamo.js';
import {
  validateEmail,
  validatePassword,
  validateUserName,
} from './validation.js';

export async function getUser(userName) {
  const params = {
    TableName: USERS_TABLE,
    Key: { userName: { S: userName } },
  };
  try {
    const data = await dynamoClient.send(new GetItemCommand(params));
    if (!data.Item) return null;
    return {
      userName: data.Item.userName.S,
      passwordHash: data.Item.passwordHash?.S || null,
      email: data.Item.email?.S || null,
      createdAt: data.Item.createdAt?.S || null,
      lastLogin: data.Item.lastLogin?.S || null,
      isAdmin: data.Item.isAdmin?.BOOL || false,
      resetToken: data.Item.resetToken?.S || null,
      resetTokenExpiry: data.Item.resetTokenExpiry?.S || null,
      savedPins: data.Item.savedPins ? JSON.parse(data.Item.savedPins.S) : [],
    };
  } catch (err) {
    console.error('Error getting user:', err);
    return null;
  }
}

export async function saveUser(user) {
  const item = { userName: { S: user.userName } };
  if (user.passwordHash) item.passwordHash = { S: user.passwordHash };
  if (user.email) item.email = { S: user.email };
  if (user.createdAt) item.createdAt = { S: user.createdAt };
  if (user.lastLogin) item.lastLogin = { S: user.lastLogin };
  if (user.isAdmin !== undefined) item.isAdmin = { BOOL: !!user.isAdmin };
  if (user.resetToken) item.resetToken = { S: user.resetToken };
  if (user.resetTokenExpiry) item.resetTokenExpiry = { S: user.resetTokenExpiry };
  if (user.savedPins) item.savedPins = { S: JSON.stringify(user.savedPins) };

  try {
    await dynamoClient.send(
      new PutItemCommand({ TableName: USERS_TABLE, Item: item }),
    );
    return true;
  } catch (err) {
    console.error('Error saving user:', err);
    return false;
  }
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const params = {
    TableName: USERS_TABLE,
    FilterExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': { S: email.trim().toLowerCase() } },
  };
  try {
    const data = await dynamoClient.send(new ScanCommand(params));
    if (!data.Items || data.Items.length === 0) return null;
    const item = data.Items[0];
    return {
      userName: item.userName.S,
      passwordHash: item.passwordHash?.S || null,
      email: item.email?.S || null,
      createdAt: item.createdAt?.S || null,
      lastLogin: item.lastLogin?.S || null,
      isAdmin: item.isAdmin?.BOOL || false,
      resetToken: item.resetToken?.S || null,
      resetTokenExpiry: item.resetTokenExpiry?.S || null,
      savedPins: item.savedPins ? JSON.parse(item.savedPins.S) : [],
    };
  } catch (err) {
    console.error('Error finding user by email:', err);
    return null;
  }
}

export async function createUser(userData) {
  const { userName, password, email } = userData;
  const userNameValidation = validateUserName(userName);
  if (!userNameValidation.valid) throw new Error(userNameValidation.message);
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) throw new Error(emailValidation.message);
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) throw new Error(passwordValidation.message);

  const existingUser = await getUser(userName.trim());
  if (existingUser && existingUser.passwordHash) {
    throw new Error('Username already registered');
  }
  const existingEmail = await getUserByEmail(email.trim().toLowerCase());
  if (existingEmail) {
    throw new Error('Email already registered');
  }
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  const now = new Date().toISOString();
  const user = {
    userName: userName.trim(),
    passwordHash,
    email: email.trim().toLowerCase(),
    createdAt: now,
    lastLogin: now,
    // Admin is granted only by editing the record in DynamoDB, never by choice of name.
    isAdmin: false,
    savedPins: [],
  };
  if (!(await saveUser(user))) {
    throw new Error('Failed to create user');
  }
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function verifyUser(userName, password) {
  if (!userName || !password) {
    throw new Error('Username and password are required');
  }
  const user = await getUser(userName);
  if (!user || !user.passwordHash) {
    throw new Error('Invalid username or password');
  }
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid username or password');
  }
  user.lastLogin = new Date().toISOString();
  await saveUser(user);
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function requestPasswordReset(email) {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('No account found with that email address');
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  user.resetToken = token;
  user.resetTokenExpiry = expiry;
  await saveUser(user);
  return { userName: user.userName, email: user.email, token };
}

export async function resetPassword(token, newPassword) {
  if (!token) throw new Error('Reset token is required');
  const params = {
    TableName: USERS_TABLE,
    FilterExpression: 'resetToken = :token',
    ExpressionAttributeValues: { ':token': { S: token } },
  };
  const data = await dynamoClient.send(new ScanCommand(params));
  if (!data.Items || data.Items.length === 0) {
    throw new Error('Invalid or expired reset link');
  }
  const item = data.Items[0];
  const expiry = item.resetTokenExpiry?.S;
  if (!expiry || new Date(expiry) < new Date()) {
    throw new Error('Reset link has expired');
  }
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) throw new Error(passwordValidation.message);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const user = {
    userName: item.userName.S,
    passwordHash,
    email: item.email?.S || null,
    createdAt: item.createdAt?.S || null,
    lastLogin: item.lastLogin?.S || null,
    isAdmin: item.isAdmin?.BOOL || false,
    resetToken: null,
    resetTokenExpiry: null,
    savedPins: item.savedPins ? JSON.parse(item.savedPins.S) : [],
  };
  await saveUser(user);
  return { userName: user.userName };
}
