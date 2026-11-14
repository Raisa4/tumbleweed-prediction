import { useState } from "react";
import type { Tab } from "./App";

const STEPS: { tab: Tab; text: string }[] = [
  {
    tab: "trends",
    text: "March 2024, South Jordan, Utah: walls of tumbleweed block whole streets overnight. First question: is the weather behind pile-ups like this changing? Look at the badge on each card.",
  },
  {
    tab: "pileups",
    text: "Reality check. The March 2024 pile-up grew in season 2023. Where did our index rank that season, and before the 2018 pile-ups?",
  },
  {
    tab: "map",
    text: "Geography. Teal is open land where plants grow; orange is where the wind drops them, and the pins mark the top hotspots. Move the wind slider on the right: the hotspots sit on the built edge downwind of open land.",
  },
  {
    tab: "forecast",
    text: "Could we have warned South Jordan? Season 2023 predicted from 2001–2022 only, next to what really happened, with the score from 12 earlier test seasons.",
  },
];

export default function Demo({
  onStep,
  onClose,
}: {
  onStep: (tab: Tab, region: string) => void;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);

  const move = (n: number) => {
    setI(n);
    onStep(STEPS[n].tab, "salt_lake_valley");
  };

  return (
    <div className="demo-bar" role="dialog" aria-label="Guided demo">
      <span className="demo-count">
        Step {i + 1} of {STEPS.length}
      </span>
      <p>{STEPS[i].text}</p>
      {i > 0 && (
        <button className="ghost" onClick={() => move(i - 1)}>
          Back
        </button>
      )}
      <button onClick={() => (i + 1 === STEPS.length ? onClose() : move(i + 1))}>
        {i + 1 === STEPS.length ? "Finish" : "Next"}
      </button>
      <button className="demo-x" onClick={onClose} aria-label="Close demo">
        ×
      </button>
    </div>
  );
}
