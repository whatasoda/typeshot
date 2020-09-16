import ts from 'typescript';
import { CustomContent } from '../typeshot';
import { getNodeByStack } from '../utils/source-file-search';

export const resolveCustomContent = (customContent: CustomContent | null, sourceFile: ts.SourceFile) => {
  if (!customContent) return '';

  const { type, leadingStack, tailingStack, leadingContent, tailingContent } = customContent;
  if (!tailingStack || !tailingContent) throw new Error(`Tailing content of ${type} is not found.`);

  const [leadingRoot] = getNodeByStack(leadingStack, sourceFile).nodePath;
  const [tailingRoot] = getNodeByStack(tailingStack, sourceFile).nodePath;
  let acc = '';
  leadingContent.forEach((content) => {
    acc += typeof content === 'function' ? content() : content;
  });
  acc += sourceFile.getFullText().slice(leadingRoot.getEnd(), tailingRoot.getStart());
  tailingContent.forEach((content) => {
    acc += typeof content === 'function' ? content() : content;
  });
  return acc;
};
