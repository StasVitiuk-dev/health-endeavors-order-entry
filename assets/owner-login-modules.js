// Health Endeavors owner dashboard: module registry (EXT15).
// Each file in assets/app/ registers one module here with define(); nothing runs
// at that point. The program (owner-login-app.js) checks that every module it
// needs is present with the compatibility number it expects, then creates them
// one by one, in a fixed order, handing each exactly the inputs it lists. A
// module cannot be created twice, and cannot reach another module except
// through what the program hands it, so there are no hidden load-order or
// circular dependencies (tests/tools/app-modules.js checks the graph).
(function () {
  var HE = window.HE = window.HE || {};
  if (HE.modules) return;
  var defs = Object.create(null);
  function define(name, meta, factory) {
    if (defs[name]) throw new Error('Module defined twice: ' + name);
    defs[name] = { api: meta.api, needs: (meta.needs || []).slice(), factory: factory, instance: null };
  }
  function missing(required) { return Object.keys(required).filter(function (n) { return !defs[n]; }); }
  function mismatched(required) { return Object.keys(required).filter(function (n) { return defs[n] && defs[n].api !== required[n]; }); }
  function create(name, ctx) {
    var d = defs[name];
    if (!d) throw new Error('Module missing: ' + name);
    if (d.instance) throw new Error('Module created twice: ' + name);
    var absent = d.needs.filter(function (k) { return !(k in ctx) || ctx[k] === undefined; });
    if (absent.length) throw new Error('Module ' + name + ' is missing inputs: ' + absent.join(', '));
    d.instance = Object.freeze(d.factory(ctx));
    return d.instance;
  }
  function list() {
    return Object.keys(defs).map(function (n) { return { name: n, api: defs[n].api, created: !!defs[n].instance }; });
  }
  HE.modules = Object.freeze({ REGISTRY_API: 1, define: define, create: create, missing: missing, mismatched: mismatched, list: list });
})();
