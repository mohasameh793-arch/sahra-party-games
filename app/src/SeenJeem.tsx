// سين جيم: team board, question with timer, pass/steal, reveal, host judges.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RoomState, send } from "./net";
import { Body, Btn, C, Card, ErrorLine, F, GameTop, Row, Screen, Title, useCountdown } from "./ui";

const TEAM = { a: { name: "الفريق الأحمر", color: C.red }, b: { name: "الفريق الأبيض", color: C.wool } } as const;
type T = "a" | "b";

export function SeenJeem({ state }: { state: RoomState }) {
  const g = state.game;
  const host = state.you.isHost;
  const [pit, setPit] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (data: object) => { setErr(null); const r = await send("action", data); if (r.error) setErr(r.error); };
  const name = (id: string) => state.players?.find((p) => p.id === id)?.name ?? "؟";
  const turn = g.turn as T, mine = g.myTeam as T, myTurn = mine === turn;
  const left = useCountdown(g.cur?.msLeft, `${g.cur?.cat}-${g.cur?.pts}-${g.cur?.passed}-${g.cur?.friend}`);

  const scores = (
    <Row>
      {(["a", "b"] as T[]).map((t) => (
        <View key={t} style={[st.score, { borderColor: TEAM[t].color }, turn === t && g.phase !== "result" && { backgroundColor: C.surface }]}>
          <Text style={st.teamName}>{`${TEAM[t].name}${mine === t ? " · فريقك" : ""}`}</Text>
          <Text style={st.points}>{g.points[t]}</Text>
          <Text style={st.members}>{g.teams[t].map(name).join("، ")}</Text>
        </View>
      ))}
    </Row>
  );

  let body;
  if (!g.playing) body = <Card><Body>الجولة شغالة، بتدخل الجولة الجاية.</Body></Card>;
  else if (g.phase === "board") {
    const canPit = myTurn && g.helpers[mine].pit;
    body = (
      <>
        <Title size={22}>{myTurn ? "دوركم: اختاروا سؤال" : `دور ${TEAM[turn].name}`}</Title>
        {canPit && (
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: pit }} onPress={() => setPit(!pit)}
            style={[st.pit, pit && { borderColor: C.red, backgroundColor: "#2c1715" }]}>
            <Text style={st.pitText}>{pit ? "الحفرة مفعّلة: لو جاوبتوا صح تنخصم النقاط منهم" : "استخدم الحفرة في السؤال الجاي"}</Text>
          </Pressable>
        )}
        {g.board.map((c: { cat: string; cells: { pts: number; used: boolean; winner: T | null }[] }, col: number) => (
          <View key={c.cat} style={st.boardRow}>
            <Text style={st.cat}>{c.cat}</Text>
            <Row style={{ flex: 1, justifyContent: "flex-end" }}>
              {c.cells.map((x, row) => (
                <Pressable key={x.pts} accessibilityRole="button" accessibilityLabel={`${c.cat} ${x.pts}`} disabled={x.used || !myTurn}
                  onPress={() => { act({ type: "pick", col, row, pit }); setPit(false); }}
                  style={[st.cell, x.used && { opacity: 0.35, borderColor: x.winner ? TEAM[x.winner].color : C.line }]}>
                  <Text style={st.cellText}>{x.used ? (x.winner ? "✓" : "—") : x.pts}</Text>
                </Pressable>
              ))}
            </Row>
          </View>
        ))}
      </>
    );
  } else if (g.phase === "question" || g.phase === "reveal") {
    const c = g.cur;
    const answering: T = c.passed ? (turn === "a" ? "b" : "a") : turn;
    body = (
      <>
        <Row style={{ justifyContent: "space-between" }}>
          <Body muted>{`${c.cat} · ${c.pts}${c.pit ? " · الحفرة" : ""}`}</Body>
          {g.phase === "question" && <Text style={[st.timer, left !== null && left <= 10 && { color: C.red }]}>{left ?? ""}</Text>}
        </Row>
        <Card style={{ borderColor: TEAM[answering].color, paddingVertical: 26 }}>
          <Text style={st.q}>{c.q}</Text>
          {g.phase === "reveal" && <Text style={st.answer}>{c.a}</Text>}
        </Card>
        {g.phase === "question" && (
          <>
            <Body>{`يجاوب الحين: ${TEAM[answering].name}${c.two ? " (يقدر يقول جوابين)" : ""}${c.friend ? " · اتصال بصديق" : ""}`}</Body>
            {myTurn && !c.passed && (
              <Row>
                {g.helpers[mine].friend && <Btn label="اتصل بصديق" kind="ghost" onPress={() => act({ type: "helper", name: "friend" })} style={{ flex: 1 }} />}
                {g.helpers[mine].two && <Btn label="جاوب جوابين" kind="ghost" onPress={() => act({ type: "helper", name: "two" })} style={{ flex: 1 }} />}
              </Row>
            )}
            {!c.passed && (myTurn || host) && <Btn label="ما نعرف، مرّر للفريق الثاني" kind="ghost" onPress={() => act({ type: "pass" })} />}
            <Btn label="اكشف الجواب" onPress={() => act({ type: "reveal" })} />
          </>
        )}
        {g.phase === "reveal" && (host ? (
          <>
            <Title size={20}>مين جاوب صح؟</Title>
            <Btn label={TEAM[turn].name} color={turn === "a" ? C.red : C.teal} onPress={() => act({ type: "judge", winner: "turn" })} />
            {c.passed && <Btn label={TEAM[answering].name} color={answering === "a" ? C.red : C.teal} onPress={() => act({ type: "judge", winner: "other" })} />}
            <Btn label="محد جاوب صح" kind="ghost" onPress={() => act({ type: "judge", winner: "none" })} />
          </>
        ) : <Body muted>المضيف يحكم مين جاوب صح.</Body>)}
      </>
    );
  } else {
    body = (
      <>
        <Card style={{ borderColor: g.winner ? TEAM[g.winner as T].color : C.line }}>
          <Text style={st.q}>{g.winner ? `فاز ${TEAM[g.winner as T].name}!` : "تعادل!"}</Text>
        </Card>
        {host ? <Btn label="لوحة جديدة" onPress={() => act({ type: "again" })} /> : <Body muted>المضيف يقرر.</Body>}
      </>
    );
  }

  return (
    <Screen>
      <GameTop title="سين جيم" category="saudi" host={host} onEnd={() => send("endGame")} />
      {scores}
      <ErrorLine text={err} />
      {body}
    </Screen>
  );
}

const st = StyleSheet.create({
  score: { flex: 1, borderWidth: 2, borderRadius: 6, padding: 10, gap: 2 },
  teamName: { fontFamily: F.bold, color: C.wool, fontSize: 14, textAlign: "right" },
  points: { fontFamily: F.head, color: C.amber, fontSize: 30, lineHeight: 44, textAlign: "right" },
  members: { fontFamily: F.body, color: C.muted, fontSize: 12, textAlign: "right" },
  boardRow: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6 },
  cat: { fontFamily: F.bold, color: C.wool, fontSize: 15, width: 110, textAlign: "right" },
  cell: { minWidth: 62, minHeight: 46, borderRadius: 6, borderWidth: 1.5, borderColor: C.red, alignItems: "center", justifyContent: "center", backgroundColor: C.surface },
  cellText: { fontFamily: F.head, color: C.wool, fontSize: 18 },
  pit: { borderWidth: 1.5, borderColor: C.line, borderStyle: "dashed", borderRadius: 6, padding: 12 },
  pitText: { fontFamily: F.bold, color: C.wool, fontSize: 14, textAlign: "center" },
  timer: { fontFamily: F.head, color: C.wool, fontSize: 32, lineHeight: 44 },
  q: { fontFamily: F.head, color: C.wool, fontSize: 24, lineHeight: 40, textAlign: "center" },
  answer: { fontFamily: F.head, color: C.amber, fontSize: 30, lineHeight: 46, textAlign: "center", marginTop: 12 },
});
