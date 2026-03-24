import { analyzeTypes } from "./shared/analyze";
import { renderTypeMap } from "./shared/render";
import { setupPage } from "./shared/page";
import { TYPE_MAP_SAMPLE } from "./shared/sample-code";

setupPage({
  inputId: "code-input",
  outputId: "diagram-output",
  sampleCode: TYPE_MAP_SAMPLE,
  onUpdate: (code) => renderTypeMap(analyzeTypes(code)),
});
