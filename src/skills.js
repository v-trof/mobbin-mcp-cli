import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MobbinError } from './mcp-client.js';

const SKILLS_DIR = new URL('../skills/', import.meta.url);
const DEFAULT_SKILL = 'mobbin-design';
const INSTALL_MARKER = '.mobbin-skill.json';
const INSTALL_TARGETS = {
  claude: { user: () => path.join(homedir(), '.claude', 'skills'), project: path.join('.claude', 'skills') },
  agents: { user: () => path.join(homedir(), '.agents', 'skills'), project: path.join('.agents', 'skills') },
  codex: { user: () => path.join(process.env.CODEX_HOME || path.join(homedir(), '.codex'), 'skills'), project: path.join('.agents', 'skills') }
};

function frontmatter(content) {
  const block = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const field = (key) => block.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1].trim().replace(/^"(.*)"$/, '$1');
  // `metadata.invocation: user` marks skills that must only run when the user asks; install translates it per harness.
  return { description: field('description'), userInvoked: /^\s+invocation:\s*user\s*$/m.test(block) };
}

async function listSkills() {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return Promise.all(names.map(async (name) => ({ name, ...frontmatter(await readFile(new URL(`${name}/SKILL.md`, SKILLS_DIR), 'utf8')) })));
}

async function findSkills(names) {
  const skills = await listSkills();
  const unknown = names.filter((name) => !skills.some((skill) => skill.name === name));
  if (unknown.length) throw new MobbinError(`Unknown skill: ${unknown.join(', ')}. Available: ${skills.map(({ name }) => name).join(', ')}.`);
  return names.length ? skills.filter((skill) => names.includes(skill.name)) : skills;
}

async function readSkill(name = DEFAULT_SKILL, ref) {
  await findSkills([name]);
  if (ref === undefined) return readFile(new URL(`${name}/SKILL.md`, SKILLS_DIR), 'utf8');
  const file = ref.endsWith('.md') ? ref : `${ref}.md`;
  const refs = await readdir(new URL(`${name}/references/`, SKILLS_DIR)).catch(() => []);
  if (!refs.includes(file)) throw new MobbinError(`${name} has no reference ${file}.${refs.length ? ` Available: ${refs.join(', ')}.` : ''}`);
  return readFile(new URL(`${name}/references/${file}`, SKILLS_DIR), 'utf8');
}

function installRoot({ target, project, dir }, cwd) {
  if (target !== undefined && !INSTALL_TARGETS[target]) throw new MobbinError(`--target must be one of: ${Object.keys(INSTALL_TARGETS).join(', ')}.`);
  if (dir) return path.resolve(cwd, dir);
  if (!target) throw new MobbinError(`Pass --target ${Object.keys(INSTALL_TARGETS).join('|')} or --dir PATH.`);
  return project ? path.resolve(cwd, INSTALL_TARGETS[target].project) : INSTALL_TARGETS[target].user();
}

async function installSkills(names, options = {}, cwd = process.cwd()) {
  const target = options.target?.toLowerCase();
  const root = installRoot({ target, project: options.project, dir: options.dir }, cwd);
  const skills = await findSkills(names);
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const exists = (file) => stat(file).then(() => true, () => false);

  // Check every destination before touching any, so a refusal never leaves a partial install.
  for (const { name } of skills) {
    const dest = path.join(root, name);
    if (await exists(dest) && !(await exists(path.join(dest, INSTALL_MARKER))) && !options.force) {
      throw new MobbinError(`${dest} exists and was not installed by mobbin. Pass --force to replace it.`);
    }
  }

  const installed = [];
  for (const { name, userInvoked } of skills) {
    const dest = path.join(root, name);
    await rm(dest, { recursive: true, force: true });
    await cp(fileURLToPath(new URL(`${name}/`, SKILLS_DIR)), dest, { recursive: true });
    if (userInvoked && target === 'claude') {
      const skillFile = path.join(dest, 'SKILL.md');
      const content = await readFile(skillFile, 'utf8');
      await writeFile(skillFile, content.replace(/^(---\r?\n[\s\S]*?)((\r?\n)---)/, '$1$3disable-model-invocation: true$2'));
    } else if (userInvoked) {
      await mkdir(path.join(dest, 'agents'), { recursive: true });
      await writeFile(path.join(dest, 'agents', 'openai.yaml'), 'policy:\n  allow_implicit_invocation: false\n');
    }
    await writeFile(path.join(dest, INSTALL_MARKER), `${JSON.stringify({ package: 'mobbin-mcp-cli', version }, null, 2)}\n`);
    installed.push({ name, path: dest });
  }
  return { root, installed };
}

export { DEFAULT_SKILL, INSTALL_MARKER, installSkills, listSkills, readSkill };
