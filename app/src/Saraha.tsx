// صراحة: same question for everyone, answers shown without names after the host checks them.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RoomState, send } from "./net";
import { Body, Btn, C, Card, ErrorLine, F, Field, GameTop, Row, Screen, Title } from "./ui";

export function Saraha({ state }: { state: RoomState }) {
  const g = state.game;
  const host = state.you.isHost;
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setText(""), [g.number]);
  const act = async (data: object) => { setErr(null); const r = await send("action", data); if (r.error) setErr(r.error); };
  const name = (id: string) => state.players?.find((p) => p.id === id)?.name ?? "؟";
  const shown = (v: string) => (g.kind === "pick" ? name(v) : v);

  let body;
  if (!g.playing) body = <Card><Body>الجولة شغالة، هتدخل الجولة الجاية.</Body></Card>;
  else if (g.phase === "result") {
    body = (
      <>
        <Card><Body>خلصت الأسئلة. شكراً على الصراحة!</Body></Card>
        {host && <Btn label="نعيد من الأول" color={C.teal} onPress={() => act({ type: "again" })} />}
      </>
    );
  } else {
    const question = (
      <Card style={{ borderColor: C.teal, paddingVertical: 24 }}>
        <Body muted style={{ textAlign: "center" }}>{`سؤال ${g.number}`}</Body>
        <Text style={st.q}>{g.question}</Text>
      </Card>
    );
    if (g.phase === "answer") {
      body = (
        <>
          {question}
          {g.mine !== null ? (
            <Card><Body>{`إجابتك اتبعتت: ${shown(g.mine)}`}</Body><Body muted>{`مستنيين الباقيين… ${g.answered} من ${g.ids.length}`}</Body></Card>
          ) : g.kind === "pick" ? (
            <>
              <Body muted>اختار حد. محدش هيعرف إنت اخترت مين.</Body>
              {g.ids.map((id: string) => (
                <Pressable key={id} accessibilityRole="button" onPress={() => act({ type: "answer", value: id })} style={st.pick}>
                  <Text style={st.pickText}>{name(id)}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Field label="إجابتك (من غير اسم)" value={text} onChangeText={setText} maxLength={140} multiline placeholder="اكتب بصراحة" style={{ minHeight: 90 }} />
              <Btn label="ابعت" color={C.teal} disabled={!text.trim()} onPress={() => act({ type: "answer", value: text })} />
            </>
          )}
          {host && <Btn label="كفاية، نشوف الإجابات" kind="ghost" onPress={() => act({ type: "force" })} />}
        </>
      );
    } else if (g.phase === "check") {
      body = host ? (
        <>
          {question}
          <Body muted>إنت بس شايف دول. شيل أي إجابة مش لطيفة قبل ما الكل يشوفها.</Body>
          {g.list.map((x: { value: string; hidden: boolean }, i: number) => (
            <Row key={i} style={x.hidden ? { ...st.row, opacity: 0.45 } : st.row}>
              <Body style={{ flex: 1, textDecorationLine: x.hidden ? "line-through" : "none" }}>{shown(x.value)}</Body>
              <Btn label={x.hidden ? "رجّعها" : "شيلها"} kind="ghost" onPress={() => act({ type: "hide", index: i })} style={{ minHeight: 40 }} />
            </Row>
          ))}
          <Btn label="اعرضهم للكل" color={C.teal} onPress={() => act({ type: "show" })} />
        </>
      ) : <>{question}<Card><Body>المضيف بيراجع الإجابات… ثواني.</Body></Card></>;
    } else {
      const items: string[] = g.list;
      // Pick questions: show how many times each person was chosen, not who chose.
      const tally = g.kind === "pick" ? Object.entries(items.reduce<Record<string, number>>((m, v) => ({ ...m, [v]: (m[v] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]) : null;
      const max = tally ? Math.max(...tally.map(([, n]) => n)) : 0;
      body = (
        <>
          {question}
          {tally ? tally.map(([id, n]) => (
            <View key={id} style={{ gap: 4 }}>
              <Row style={{ justifyContent: "space-between" }}><Body>{name(id)}</Body><Text style={st.n}>{n}</Text></Row>
              <View style={[st.bar, { width: `${(n / max) * 100}%` }]} />
            </View>
          )) : items.map((t, i) => <Card key={i}><Body>{t}</Body></Card>)}
          {!items.length && <Body muted>المضيف شال كل الإجابات.</Body>}
          {host ? <Btn label="السؤال اللي بعده" color={C.teal} onPress={() => act({ type: "next" })} /> : <Body muted>المضيف بيكمّل.</Body>}
        </>
      );
    }
  }

  return (
    <Screen>
      <GameTop title="صراحة" category="egypt" host={host} onEnd={() => send("endGame")} />
      <ErrorLine text={err} />
      {body}
    </Screen>
  );
}

const st = StyleSheet.create({
  q: { fontFamily: F.head, color: C.wool, fontSize: 24, lineHeight: 40, textAlign: "center" },
  pick: { minHeight: 56, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, justifyContent: "center", paddingHorizontal: 16, backgroundColor: C.surface },
  pickText: { fontFamily: F.bold, color: C.wool, fontSize: 18, textAlign: "right" },
  row: { backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.line, padding: 10 },
  n: { fontFamily: F.head, color: C.amber, fontSize: 22 },
  bar: { height: 10, borderRadius: 3, backgroundColor: C.teal, alignSelf: "flex-start" },
});
