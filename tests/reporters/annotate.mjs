// node --test reporter for CI: each failed test becomes a GitHub annotation
// (shown on the PR's checks page, and readable through the checks API).
// Used next to the normal spec reporter in .github/workflows/ci.yml.
export default async function* annotate(source) {
  for await (const event of source) {
    if (event.type !== 'test:fail') continue;
    const { name, details, file, line } = event.data;
    const err = details?.error;
    // Suites fail when a child does; annotate the tests themselves.
    if (err?.failureType === 'subtestsFailed') continue;
    const cause = err?.cause ?? err;
    const message = String(cause?.message ?? cause ?? 'failed')
      .slice(0, 900)
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A');
    const where = file ? ` file=${file.replace(process.cwd() + '/', '')}${line ? `,line=${line}` : ''}` : '';
    yield `::error${where},title=${String(name).replace(/[,:]/g, ' ').slice(0, 200)}::${message}\n`;
  }
}
