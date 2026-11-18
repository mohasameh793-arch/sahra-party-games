// Plays a game the AI built from a video: secret roles / secret word (hold card + timer + optional vote),
// turn-by-turn cards, or trivia judged by the host.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RoomState, send } from "./net";
import { Body, Btn, C, Card, ErrorLine, F, GameTop, HoldCard, Row, Screen, Title, useCountdown } from "./ui";

export function Custom({ state }: { state: RoomState }) {
  const g = state.game;
  const cat = g.info?.category ?? "saudi";
  const color = cat === "egypt" ? C.teal : C.red;
  const host = state.you.isHost;
  const me = state.you.id;
  const [err, setErr] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  useEffect(() => { if (g.phase !== "reveal") setHeld(false); }, [g.phase, g.round]);
  const act = async (data: object) => { setErr(null); const r = await send("action", data); if (r.error) setErr(r.error); };
  const name = (id: string) => state.players?.find((p) => p.id === id)?.name ?? "؟";
  const left = useCountdown(g.msLeft, `${g.phase}-${g.round}-${g.count ?? ""}-${g.out?.length ?? 0}`);

  if (g.missing) return <Screen><Card><Body>هذي اللعبة انحذفت.</Body></Card></Screen>;

  const timer = left !== null && (
    <Row style={{ justifyContent: "space-between" }}>
      <Body muted>المؤقت</Body>
      <Text style={[st.timer, left <= 10 && { color: C.red }]}>{left}</Text>
    </Row>
  );
  const secretCard = g.secret && (
    <HoldCard color={color} onSeen={() => setHeld(true)}>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Text style={st.big}>{g.secret.title}</Text>
        <Body style={{ textAlign: "center" }}>{g.secret.text}</Body>
      </View>
    </HoldCard>
  );

  let body;
  if (!g.playing) body = <Card><Body>الجولة شغالة، بتدخل الجولة الجاية.</Body></Card>;
  else if (g.phase === "reveal") {
    const seen = g.seen.includes(me);
    body = (
      <>
        {secretCard}
        <Btn label={seen ? "تمام، ننتظر الباقين" : "شفت"} color={color} disabled={seen || !held} onPress={() => act({ type: "seen" })} />
        <Body muted>{`${g.seen.length} من ${g.ids.length} شافوا`}</Body>
      </>
    );
  } else if (g.phase === "vote") {
    const others = g.alive.filter((id: string) => id !== me);
    body = g.alive.includes(me) ? (
      <>
        <Title size={22}>صوّت: مين يطلع؟</Title>
        {[...others, null].map((id: string | null) => (
          <Pressable key={id ?? "none"} accessibilityRole="radio" accessibilityState={{ checked: g.myVote === id }} onPress={() => act({ type: "vote", targetId: id })}
            style={[st.pick, g.myVote === id && { borderColor: color }]}>
            <Text style={st.pickText}>{id ? name(id) : "محد"}</Text>
          </Pressable>
        ))}
        <Body muted>{`${g.voted.length} من ${g.alive.length} صوّتوا`}</Body>
      </>
    ) : <Card><Body>طلعت من الجولة. تفرّج بس.</Body></Card>;
  } else if (g.phase === "play" && (g.mechanic === "roles" || g.mechanic === "secret_word")) {
    body = (
      <>
        {timer}
        {g.lastOut && <Card style={{ borderColor: color }}><Text style={st.news}>{`${name(g.lastOut)} طلع — كان: ${g.revealed[g.lastOut]}`}</Text></Card>}
        <Title size={22}>العبوا حسب القوانين</Title>
        {g.alive.includes(me) ? secretCard : <Card><Body>طلعت من الجولة. تفرّج بس.</Body></Card>}
        {host && (
          <>
            <Btn label="أعد المؤقت" kind="ghost" onPress={() => act({ type: "timer" })} />
            {g.voting && <Btn label="للتصويت" color={color} onPress={() => act({ type: "toVote" })} />}
            <Btn label="خلّصت الجولة، اكشف الكل" kind="ghost" onPress={() => act({ type: "end" })} />
          </>
        )}
      </>
    );
  } else if (g.phase === "play" && g.mechanic === "prompts") {
    const mine = g.player === me;
    body = (
      <>
        {timer}
        <Body muted>{`بطاقة ${g.count}`}</Body>
        <Card style={{ borderColor: color, paddingVertical: 24 }}>
          <Body muted style={{ textAlign: "center" }}>{mine ? "دورك!" : `دور ${name(g.player)}`}</Body>
          <Text style={st.big}>{g.prompt}</Text>
        </Card>
        {(mine || host) && <Btn label="اللي بعده" color={color} onPress={() => act({ type: "next" })} />}
        {host && <Btn label="إنهاء" kind="ghost" onPress={() => act({ type: "end" })} />}
      </>
    );
  } else if (g.phase === "play" && g.mechanic === "trivia") {
    body = (
      <>
        <Body muted>{`سؤال ${g.number} من ${g.of}`}</Body>
        <Card style={{ borderColor: color, paddingVertical: 24 }}>
          <Text style={st.big}>{g.q}</Text>
          {g.a && <Text style={[st.big, { color: C.amber }]}>{g.a}</Text>}
        </Card>
        {host && !g.a && <Btn label="اكشف الجواب" color={color} onPress={() => act({ type: "show" })} />}
        {host && g.a && (
          <>
            <Title size={20}>مين جاوب صح أول؟</Title>
            {g.ids.map((id: string) => <Btn key={id} label={name(id)} kind="ghost" onPress={() => act({ type: "point", id })} />)}
            <Btn label="محد" kind="ghost" onPress={() => act({ type: "point", id: null })} />
          </>
        )}
        {!host && <Body muted>جاوبوا بصوت عالي، والمضيف يحكم.</Body>}
      </>
    );
  } else {
    body = (
      <>
        {g.revealed && (
          <Card>
            <Title size={20}>الكل</Title>
            {Object.entries(g.revealed).map(([id, title]) => <Body key={id}>{`${name(id)} — ${title}`}</Body>)}
          </Card>
        )}
        {g.total && (
          <Card>
            <Title size={20}>النقاط</Title>
            {Object.entries(g.total as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([id, n]) => <Body key={id}>{`${name(id)}: ${n}`}</Body>)}
          </Card>
        )}
        {host ? <Btn label="جولة ثانية" color={color} onPress={() => act({ type: "again" })} /> : <Body muted>المضيف يقرر.</Body>}
      </>
    );
  }

  return (
    <Screen>
      <GameTop title={g.name ?? "لعبة"} category={cat} host={host} onEnd={() => send("endGame")} />
      <ErrorLine text={err} />
      {body}
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { fontFamily: F.head, color: C.wool, fontSize: 26, lineHeight: 42, textAlign: "center" },
  news: { fontFamily: F.head, color: C.wool, fontSize: 20, lineHeight: 32, textAlign: "right" },
  timer: { fontFamily: F.head, color: C.wool, fontSize: 30, lineHeight: 42 },
  pick: { minHeight: 56, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, justifyContent: "center", paddingHorizontal: 16, backgroundColor: C.surface },
  pickText: { fontFamily: F.bold, color: C.wool, fontSize: 18, textAlign: "right" },
});
