// حزورة: one riddle at a time, private answer box, countdown, then the reveal.
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { RoomState, send } from "./net";
import { Body, Btn, C, Card, ErrorLine, F, Field, GameTop, Row, Screen, Title, useCountdown } from "./ui";

export function Hazzoura({ state }: { state: RoomState }) {
  const g = state.game;
  const host = state.you.isHost;
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const act = async (data: object) => { setErr(null); const r = await send("action", data); if (r.error) setErr(r.error); return r; };
  const name = (id: string) => state.players?.find((p) => p.id === id)?.name ?? "؟";
  const left = useCountdown(g.msLeft, `${g.index}-${g.phase}`, () => { if (g.phase === "ask") send("action", { type: "timeup" }); });
  const ranking = [...(state.players ?? [])].filter((p) => g.ids.includes(p.id)).sort((a, b) => (g.total[b.id] || 0) - (g.total[a.id] || 0));

  let body;
  if (!g.playing) body = <Card><Body>الجولة شغالة، بتدخل الجولة الجاية.</Body></Card>;
  else if (g.phase === "ask") {
    body = (
      <>
        <Row style={{ justifyContent: "space-between" }}>
          <Body muted>{`حزورة ${g.index + 1} من ${g.count}`}</Body>
          <Text style={[st.timer, left !== null && left <= 5 && { color: C.red }]} accessibilityLabel={`باقي ${left} ثانية`}>{left ?? ""}</Text>
        </Row>
        <Card style={{ borderColor: C.red, paddingVertical: 28 }}><Text style={st.riddle}>{g.riddle}</Text></Card>
        {g.myAnswer ? (
          <Card><Body>{`جوابك: ${g.myAnswer}`}</Body><Body muted>{`ننتظر الباقين… ${g.answered.length} من ${g.ids.length}`}</Body></Card>
        ) : (
          <>
            <Field label="جوابك (محد يشوفه)" value={text} onChangeText={setText} maxLength={40} placeholder="اكتب الجواب" autoCorrect={false}
              onSubmitEditing={() => text.trim() && act({ type: "answer", text }).then((r) => r.ok && setText(""))} />
            <Btn label="جاوب" disabled={!text.trim() || left === 0} onPress={async () => { const r = await act({ type: "answer", text }); if (r.ok) setText(""); }} />
          </>
        )}
        {host && <Btn label="اكشف الجواب الحين" kind="ghost" onPress={() => act({ type: "next" })} />}
      </>
    );
  } else if (g.phase === "reveal") {
    body = (
      <>
        <Body muted>{`حزورة ${g.index + 1} من ${g.count}`}</Body>
        <Card><Body muted>{g.riddle}</Body><Text style={st.answer}>{g.answer}</Text></Card>
        <Card>
          {g.answers.map((a: { id: string; text: string | null; ok: boolean; points: number }) => (
            <Row key={a.id} style={{ justifyContent: "space-between" }}>
              <Body style={{ flex: 1 }}>{`${name(a.id)}: ${a.text ?? "ما جاوب"}`}</Body>
              <Text style={[st.mark, { color: a.ok ? "#7fd18a" : C.muted }]}>{a.ok ? `✓ +${a.points}` : "✗"}</Text>
            </Row>
          ))}
        </Card>
        {host ? <Btn label={g.index + 1 < g.count ? "الحزورة الجاية" : "النتيجة"} onPress={() => act({ type: "next" })} /> : <Body muted>المضيف يكمّل.</Body>}
      </>
    );
  } else {
    body = (
      <>
        <Title size={24}>الترتيب</Title>
        <Card>
          {ranking.map((p, i) => (
            <Row key={p.id} style={{ justifyContent: "space-between" }}>
              <Body style={{ flex: 1 }}>{`${i + 1}. ${p.name}`}</Body>
              <Text style={st.score}>{g.total[p.id] || 0}</Text>
            </Row>
          ))}
        </Card>
        {host ? <Btn label="جولة ثانية" onPress={() => act({ type: "again" })} /> : <Body muted>المضيف يقرر.</Body>}
      </>
    );
  }

  return (
    <Screen>
      <GameTop title="حزورة" category="saudi" host={host} onEnd={() => send("endGame")} />
      <ErrorLine text={err} />
      {body}
    </Screen>
  );
}

const st = StyleSheet.create({
  timer: { fontFamily: F.head, color: C.wool, fontSize: 34, lineHeight: 46, minWidth: 50, textAlign: "center" },
  riddle: { fontFamily: F.head, color: C.wool, fontSize: 26, lineHeight: 42, textAlign: "center" },
  answer: { fontFamily: F.head, color: C.wool, fontSize: 38, lineHeight: 56, textAlign: "center" },
  mark: { fontFamily: F.bold, fontSize: 16 },
  score: { fontFamily: F.head, color: C.amber, fontSize: 22, minWidth: 34, textAlign: "center" },
});
