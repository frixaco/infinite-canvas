import { InfiniteCanvas, type InfiniteCanvasItem } from "./index";

interface MyCard extends InfiniteCanvasItem {
  title: string;
  description: string;
}

const myItems: MyCard[] = Array.from({ length: 100 }, (_, i) => ({
  id: crypto.randomUUID(),
  title: `Card ${i + 1}`,
  description: `This is card ${i + 1}`,
  x: (i % 10) * 320,
  y: Math.floor(i / 10) * 200,
  width: 280,
  height: 160,
}));

function MyCard({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        background: "#f0f0f5",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <h3 style={{ margin: 0, fontWeight: "bold" }}>{title}</h3>
      <p style={{ margin: "8px 0 0", color: "#666" }}>{description}</p>
    </div>
  );
}

export function Example() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <InfiniteCanvas items={myItems} renderItem={(item) => <MyCard title={item.title} description={item.description} />} />
    </div>
  );
}
