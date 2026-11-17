// برا السالفة: every phone renders only what the server sent it.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RoomState, send } from "./net";
import { Band, Body, Btn, C, Card, ErrorLine, F, HoldCard, Row, Screen, Title } from "./ui";

export function Outsider({ state }: { state: RoomState }) {
  const g = state.game;
  const [err, setErr] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  // Each new round must be held again before "شفت كرتي" unlocks.
  useEffect(() => { if (g.phase !== "reveal") setHeld(false); }, [g.phase]);
  const act = async (data: object) => { setErr(null); const r = await send("action", data); if (r.error) setErr(r.error); };
  const name = (id: string) => state.players?.find((p) => p.id === id)?.name ?? "؟";
  const meId = state.you.id;
  const host = state.you.isHost;

  const secret = g.secret && (
    <HoldCard onSeen={() => setHeld(true)}>
      {g.secret.outsider ? (
        <View style={st.center}>
          <Text style={st.big}>أنت برا السالفة</Text>
          <Body muted>{`ما تعرف السالفة. نوعها: ${g.category}. مثّل إنك داري.`}</Body>
        </View>
      ) : (
        <View style={st.center}>
          <Body muted>{`السالفة (${g.category})`}</Body>
          <Text style={st.big}>{g.secret.topic}</Text>
          <Body muted>واحد منكم ما يعرفها. اكشفوه.</Body>
        </View>
      )}
    </HoldCard>
  );

  let body = null;
  if (!g.playing) body = <Card><Body>الجولة شغالة، بتدخل الجولة الجاية.</Body></Card>;
  else if (g.phase === "reveal") {
    const seen = g.seen.includes(meId);
    body = (
      <>
        {secret}
        <Btn label={seen ? "تمام، ننتظر الباقين" : "شفت كرتي"} disabled={seen || !held} onPress={() => act({ type: "seen" })} />
        <Body muted>{`${g.seen.length} من ${g.ids.length} شافوا كروتهم`}</Body>
      </>
    );
  } else if (g.phase === "questions") {
    const { asker, target, index, total } = g.turn;
    const mine = asker === meId;
    body = (
      <>
        <Body muted>{`سؤال ${index + 1} من ${total}`}</Body>
        <Card style={{ borderColor: mine || target === meId ? C.red : C.line, alignItems: "stretch" }}>
          <Text style={st.big}>{mine ? "أنت" : name(asker)}</Text>
          <Body muted style={{ textAlign: "center" }}>يسأل</Body>
          <Text style={st.big}>{target === meId ? "أنت" : name(target)}</Text>
        </Card>
        {mine && <Btn label="سألت، اللي بعده" onPress={() => act({ type: "nextTurn" })} />}
        {target === meId && <Body>جاوب بدون ما تفضح السالفة.</Body>}
        {secret}
        {host && <Row><Btn label="تخطَّ السؤال" kind="ghost" onPress={() => act({ type: "nextTurn" })} style={{ flex: 1 }} />
          <Btn label="روحوا للتصويت" kind="ghost" onPress={() => act({ type: "toVote" })} style={{ flex: 1 }} /></Row>}
      </>
    );
  } else if (g.phase === "vote") {
    body = (
      <>
        <Title size={24}>مين برا السالفة؟</Title>
        <Body muted>{g.myVote ? "تقدر تغيّر صوتك لين يخلّصون الكل." : "اختر واحد."}</Body>
        {g.ids.filter((id: string) => id !== meId).map((id: string) => (
          <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: g.myVote === id }} onPress={() => act({ type: "vote", targetId: id })}
            style={[st.pick, g.myVote === id && { borderColor: C.red, backgroundColor: "#2c1715" }]}>
            <Text style={st.pickText}>{name(id)}</Text>
          </Pressable>
        ))}
        <Body muted>{`${g.voted.length} من ${g.ids.length} صوّتوا`}</Body>
      </>
    );
  } else if (g.phase === "guess") {
    body = g.options ? (
      <>
        <Title size={24}>انكشفت! فرصة أخيرة</Title>
        <Body>اختر السالفة. لو صبت تاخذ نقطتين.</Body>
        {g.options.map((o: string) => (
          <Pressable key={o} accessibilityRole="button" onPress={() => act({ type: "guess", option: o })} style={st.pick}>
            <Text style={st.pickText}>{o}</Text>
          </Pressable>
        ))}
      </>
    ) : (
      <Card><Title size={24}>{`انكشف ${name(g.accusedId)}!`}</Title><Body muted>ينتظر يخمّن السالفة…</Body></Card>
    );
  } else if (g.phase === "result") {
    const caughtText = g.caught ? (g.guess === g.topic ? "انكشف، بس صاب السالفة!" : "انكشف وما عرف السالفة.") : g.accusedId ? `هرب! طلّعتوا ${name(g.accusedId)} بالغلط.` : "هرب! تعادل التصويت.";
    body = (
      <>
        <Card style={{ borderColor: C.red }}>
          <Body muted>اللي برا السالفة كان</Body>
          <Text style={st.big}>{name(g.outsiderId)}</Text>
          <Body muted>{`والسالفة: ${g.topic}`}</Body>
          <Body>{caughtText}</Body>
        </Card>
        <Card>
          <Title size={20}>النقاط</Title>
          {[...(state.players ?? [])].sort((a, b) => b.score - a.score).map((p) => (
            <Row key={p.id} style={{ justifyContent: "space-between" }}>
              <Body style={{ flex: 1 }}>{`${p.name} — صوّت على ${g.votes[p.id] ? name(g.votes[p.id]) : "محد"}`}</Body>
              {!!g.points[p.id] && <Text style={st.plus}>{`+${g.points[p.id]}`}</Text>}
              <Text style={st.score}>{p.score}</Text>
            </Row>
          ))}
        </Card>
        {host ? <Btn label="جولة ثانية" onPress={() => act({ type: "again" })} /> : <Body muted>المضيف يقرر الجولة الجاية.</Body>}
      </>
    );
  }

  return (
    <Screen>
      <Band />
      <Row style={{ justifyContent: "space-between" }}>
        <Title size={26}>برا السالفة</Title>
        {host && <Pressable accessibilityRole="button" onPress={() => send("endGame")} hitSlop={10}><Text style={st.end}>إنهاء اللعبة</Text></Pressable>}
      </Row>
      <ErrorLine text={err} />
      {body}
    </Screen>
  );
}

const st = StyleSheet.create({
  center: { alignItems: "center", gap: 10 },
  big: { fontFamily: F.head, color: C.wool, fontSize: 36, lineHeight: 54, textAlign: "center" },
  pick: { minHeight: 56, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, justifyContent: "center", paddingHorizontal: 16, backgroundColor: C.surface },
  pickText: { fontFamily: F.bold, color: C.wool, fontSize: 18, textAlign: "right" },
  score: { fontFamily: F.head, color: C.amber, fontSize: 20, minWidth: 30, textAlign: "center" },
  plus: { fontFamily: F.bold, color: "#7fd18a", fontSize: 15 },
  end: { fontFamily: F.bold, color: C.muted, fontSize: 14 },
});
