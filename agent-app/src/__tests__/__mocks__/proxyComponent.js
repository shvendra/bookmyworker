// Generic stand-in for every shared-mobile screen / navigator that the agent
// app pulls in. A Proxy resolves ANY named or default import to the same inert
// component, so we don't have to enumerate ~30 screen exports.
const React = require('react');

const Stub = () => null;

module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === '__esModule') return true;
      return Stub;
    },
  },
);
