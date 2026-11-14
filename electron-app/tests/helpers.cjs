const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load(file, overrides = {}, globals = {}) {
  const originalRequire = createRequire(file);
  const loadedModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module: loadedModule, exports: loadedModule.exports,
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : originalRequire(name),
    __dirname: require('node:path').dirname(file),
    process, console, Buffer, URL, URLSearchParams,
    setTimeout, clearTimeout, setInterval, clearInterval,
    ...globals,
  }, { filename: file });
  return loadedModule.exports;
}

function clock() {
  let now = 0;
  const timers = new Map();
  const setTimeout = (callback, delay) => {
    const timer = { callback, at: now + delay, unref() {} };
    timers.set(timer, timer);
    return timer;
  };
  return {
    setTimeout,
    clearTimeout: timer => timers.delete(timer),
    advance(ms) {
      now += ms;
      for (const [key, timer] of timers) {
        if (timer.at <= now) { timers.delete(key); timer.callback(); }
      }
    },
  };
}

const settle = () => new Promise(resolve => setImmediate(resolve));
module.exports = { load, clock, settle };
