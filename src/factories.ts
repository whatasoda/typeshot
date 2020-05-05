import ts from 'typescript';
import { TemplateSymbols } from './symbols';

interface ConfigurationContainer {
  config?: Partial<typeshot.Configuration>;
  header?: string;
}

const ASTFactories = ts;
export const createPreTypeshot = (typeEntries: typeshot.TypeEntryContainer, acc: typeshot.ValueEntry[]) => {
  const typeshot: typeshot.Typeshot = (key, name) => (template, ...substitutions) => {
    const typeEntry = typeEntries.default[`default:${key}`];
    if (!typeEntry) {
      // eslint-disable-next-line no-console
      console.warn(`No correspond default type entry for '${key}' found.`);
      return;
    }

    acc.push({ ...typeEntry, name, template: [...template], substitutions });
  };
  typeshot.TemplateSymbols = TemplateSymbols;

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
        const substitutions: typeshot.TemplateSymbols[] = [];
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

export const createPostTypeshot = (
  typeEntries: typeshot.TypeEntryContainer,
  acc: typeshot.DefaultEntry[],
): typeshot.Typeshot => {
  const [typeshot] = createPreTypeshot(typeEntries, acc);
  typeshot.dynamic = () => {
    // eslint-disable-next-line no-console
    console.warn("Something wrong happens! 'typeshot.dynamic' should be removed in relay file.");
    return { parameters: () => () => () => {} };
  };

  return typeshot;
};
