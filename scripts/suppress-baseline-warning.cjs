const originalWarn = console.warn.bind(console);

console.warn = (...args) => {
  const [firstArg] = args;

  if (
    typeof firstArg === 'string' &&
    firstArg.includes('[baseline-browser-mapping] The data in this module is over two months old')
  ) {
    return;
  }

  originalWarn(...args);
};
