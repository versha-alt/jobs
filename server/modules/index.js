import { linkedinModule } from './linkedin.js';
import { upworkModule } from './upwork.js';

const modules = { linkedin: linkedinModule, upwork: upworkModule };

export function getModule(id) {
  const m = modules[id];
  if (!m) throw new Error(`Unknown module: ${id}`);
  return m;
}

export function listModules() {
  return Object.values(modules);
}
