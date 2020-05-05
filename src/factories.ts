import ts from 'typescript';
import { TemplateSymbols } from './symbols';
import type { TypeEntryContainer, ValueEntry, Typeshot, DefaultEntry } from '.';

interface ConfigurationContainer {
  config?: Partial<typeshot.Configuration>;
  header?: string;
}

const createTypeshotBase = (typeEntries: TypeEntryContainer, acc: ValueEntry[]): Typeshot => {
  const typeshot = ((key, name) => (template, ...substitutions) => {
    const typeEntry = typeEntries.default[`default:${key}`];
    if (!typeEntry) {
      // eslint-disable-next-line no-console
      console.warn(`No correspond default type entry for '${key}' found.`);
      return;
    }

    acc.push({ ...typeEntry, name, template: [...template], substitutions });
  }) as Typeshot;
  (typeshot as any).TemplateSymbols = TemplateSymbols;
  return typeshot;
};

const ASTFactories = ts;
export const createPreTypeshot = (typeEntries: TypeEntryContainer, acc: ValueEntry[]) => {
  const typeshot: Typeshot = createTypeshotBase(typeEntries, acc);

  let dynamicEntryCount = 0;
  typeshot.dynamic = (key) => {
    const typeEntry = typeEntries.dynamic[`dynamic:${key}`];
    if (!typeEntry) {
      // eslint-disable-next-line no-console
      console.warn(`No correspond dynamic type entry for '${key}' found.`);
      return { parameters: () => () => () => {} };
    }

    return {
      parameters: (factory) => (rawTemplate, ...rawSubstitutions) => (props) => {
        const [names, params] = factory(props, ASTFactories);

        const template: string[] = [rawTemplate[0]];
        const substitutions: TemplateSymbols[] = [];
        rawSubstitutions.forEach((curr, idx) => {
          if (
            typeof curr === 'symbol' &&
            (curr === typeshot.TemplateSymbols.NAME ||
              curr === typeshot.TemplateSymbols.CONTENT ||
              curr === typeshot.TemplateSymbols.DECLARATION)
          ) {
            substitutions.push(curr);
            template.push(rawTemplate[idx + 1]);
            return;
          }

          if (typeof curr === 'function') template[substitutions.length] += curr(props);
          template[substitutions.length] += rawTemplate[idx + 1];
        });

        acc.push({
          ...typeEntry,
          key: `dynamic:${key}-${dynamicEntryCount++}`,
          names,
          params,
          template,
          substitutions,
        });
      },
    };
  };

  const container: ConfigurationContainer = {};
  typeshot.configuration = (config) => {
    container.config = container.config || config;
    return (...args) => {
      container.header = container.header || String.raw(...args);
    };
  };

  return [typeshot, container] as const;
};

export const createPostTypeshot = (typeEntries: TypeEntryContainer, acc: DefaultEntry[]): Typeshot => {
  const typeshot = createTypeshotBase(typeEntries, acc);
  typeshot.dynamic = () => {
    // eslint-disable-next-line no-console
    console.warn("Something wrong happens! 'typeshot.dynamic' should be removed in relay file.");
    return { parameters: () => () => () => {} };
  };
  typeshot.configuration = () => {
    // eslint-disable-next-line no-console
    console.warn("Something wrong happens! 'typeshot.configuration' should be removed in relay file.");
    return () => {};
  };

  return typeshot;
};
