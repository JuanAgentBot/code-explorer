import { analyzeCallGraph } from "./shared/analyze";
import { renderCallGraph } from "./shared/render";
import { setupPage } from "./shared/page";
import { CALL_GRAPH_SAMPLE } from "./shared/sample-code";

setupPage({
  inputId: "code-input",
  outputId: "diagram-output",
  sampleCode: CALL_GRAPH_SAMPLE,
  onUpdate: (code) => renderCallGraph(analyzeCallGraph(code)),
});
