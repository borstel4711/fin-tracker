function timestamp() {
  return new Date().toISOString();
}

function log(...args) {
  console.log(`[fintrack] ${timestamp()}`, ...args);
}

function logError(...args) {
  console.error(`[fintrack:error] ${timestamp()}`, ...args);
}

module.exports = { log, logError };
