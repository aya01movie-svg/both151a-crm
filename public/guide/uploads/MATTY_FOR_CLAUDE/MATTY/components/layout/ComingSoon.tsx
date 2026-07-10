import { Card } from "@/components/ui/Card";

export function ComingSoon({
  screenName,
  phase,
}: {
  screenName: string;
  phase: string;
}) {
  return (
    <Card className="border-2 border-dashed border-navy/15 text-center py-12">
      <p className="text-navy/30 text-sm font-bold mb-2">準備中</p>
      <h1 className="text-xl font-black text-navy mb-2">{screenName}</h1>
      <p className="text-navy/50 text-sm">{phase}で実装予定です。</p>
    </Card>
  );
}
