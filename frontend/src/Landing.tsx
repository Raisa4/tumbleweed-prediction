import { useState } from "react";
import { ROLES, type RoleId } from "./vars";

const QUOTE =
  "People woke up Saturday morning and it looked like these huge walls had been erected made of tumbleweed. We had entire streets in some of our neighborhoods completely blocked.";

const COSTS = [
  { head: "Homes buried.", body: "Up to 150 houses in Victorville, California, piles reaching the second storey." },
  { head: "Roads closed.", body: "Highway 240 in Washington shut both directions for 10 hours, five cars and a semi-truck trapped." },
  { head: "Crews and equipment.", body: "Four agencies mobilised, snowplows, front loaders, a week of municipal cleanup." },
  { head: "Wildfire fuel.", body: "Dry piles against fences and ditches ignite and blow onward, carrying fire past firebreaks." },
];

export default function Landing({
  onEnter,
  onDemo,
}: {
  onEnter: (r: RoleId) => void;
  onDemo: () => void;
}) {
  const [noPhoto, setNoPhoto] = useState(false);

  return (
    <div className="landing">
      <header className="landing-top">
        <h1>Tumbleweed Trend Detective</h1>
        <p>25 years of NASA Earth observations, tested for real trends</p>
      </header>

      <div className="landing-grid">
        <div>
          <ul className="costs">
            {COSTS.map((c) => (
              <li key={c.head}>
                <strong>{c.head}</strong> {c.body}
              </li>
            ))}
          </ul>
          <div className="who">
            <h2>Who are you?</h2>
            {ROLES.map((r) => (
              <button key={r.id} className="cta" onClick={() => onEnter(r.id)}>
                {r.label} →
              </button>
            ))}
            <button className="link" onClick={onDemo}>
              ▶ Or take the 2-minute guided demo
            </button>
          </div>
        </div>

        <div>
          <blockquote className="quote">
            "{QUOTE}"
            <cite>Dawn Ramsey, Mayor of South Jordan, Utah, March 2024</cite>
          </blockquote>
          <figure className="shot" style={{ margin: 0 }}>
            {noPhoto ? (
              <span>
                Drop a photo at <code>public/hero.jpg</code> and it appears here
              </span>
            ) : (
              <img
                src="/hero.jpg"
                alt="Tumbleweeds piled against houses"
                onError={() => setNoPhoto(true)}
              />
            )}
          </figure>
        </div>
      </div>
    </div>
  );
}
