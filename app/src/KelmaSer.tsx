// كلمة سر: two clue givers see the word (hold card); teams take turns; points drop 10 → 1.
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RoomState, send } from "./net";
import { Body, Btn, C, Card, ErrorLine, F, GameTop, HoldCard, Row, Screen, Title } from "./ui";

const TEAM = { a: { name: "الفريق الأول", color: C.teal }, b: { name: "الفريق التاني", color: C.amber } } as const;
type T = "a" | "b";

export function KelmaSer({ state }: { state: RoomState }) {
  const g = state.game;
  const host = state.you.isHost;
  const me = state.you.id;
  const [err, setErr] = useState<string | null>(null);
  const act = async (data: object) => { setErr(null); const r = await send("action", data); if (r.error) setErr(r.error); };
  const name = (id: string) => state.players?.find((p) => p.id === id)?.name ?? "؟";
  const mine = g.myTeam as T, active = g.active as T;
  const iGive = g.givers.a === me || g.givers.b === me;
  const myTurnToGive = g.givers[active] === me;

  const scores = (
    <Row>
      {(["a", "b"] as T[]).map((t) => (
        <View key={t} style={[st.score, { borderColor: TEAM[t].color }]}>
          <Text style={st.teamName}>{`${TEAM[t].name}${mine === t ? " · فريقك" : ""}`}</Text>
          <Text style={st.points}>{`${g.points[t]} / ${g.target}`}</Text>
          <Text style={st.members}>{g.teams[t].map(name).join("، ")}</Text>
        </View>
      ))}
    </Row>
  );

  let body;
  if (!g.playing) body = <Card><Body>الجولة شغالة، هتدخل الجولة الجاية.</Body></Card>;
  else if (g.phase === "play") {
    body = (
      <>
        <Card style={{ borderColor: TEAM[active].color }}>
          <Body muted style={{ textAlign: "center" }}>{`الإشارة رقم ${g.clues} · تستاهل ${g.worth} نقط`}</Body>
          <Text style={st.big}>{`دور ${name(g.givers[active])}`}</Text>
          <Body style={{ textAlign: "center" }}>{`يدّي كلمة واحدة لـ ${TEAM[active].name}`}</Body>
        </Card>
        {iGive ? (
          <HoldCard color={TEAM[mine].color}>
            <View style={{ alignItems: "center", gap: 8 }}>
              <Body muted>كلمة السر</Body>
              <Text style={st.big}>{g.word}</Text>
              <Body muted>كلمة واحدة بس، ومن غير الكلمة نفسها أو حتة منها.</Body>
            </View>
          </HoldCard>
        ) : <Card><Body style={{ textAlign: "center" }}>{mine === active ? "اسمعوا الإشارة وخمّنوا بصوت عالي!" : "اسمعوا كويس… لو الإشارة مخالفة دوسوا «مخالفة»."}</Body></Card>}
        {myTurnToGive && (
          <Row>
            <Btn label="عرفوها!" color={C.teal} onPress={() => act({ type: "got" })} style={{ flex: 1 }} />
            <Btn label="غلط" kind="ghost" onPress={() => act({ type: "miss" })} style={{ flex: 1 }} />
          </Row>
        )}
        {mine !== active && <Btn label="مخالفة 🚫" kind="danger" onPress={() => act({ type: "foul" })} />}
      </>
    );
  } else {
    const L = g.last;
    body = (
      <>
        <Card style={{ borderColor: L?.team ? TEAM[L.team as T].color : C.line }}>
          <Body muted style={{ textAlign: "center" }}>الكلمة كانت</Body>
          <Text style={st.big}>{g.word}</Text>
          <Body style={{ textAlign: "center" }}>{L?.team ? `${TEAM[L.team as T].name} عرفها (+${L.pts})` : "محدش عرفها"}</Body>
        </Card>
        {g.phase === "result" && <Title size={24}>{`كسب ${TEAM[g.winner as T].name}!`}</Title>}
        {host ? (
          <Btn label={g.phase === "result" ? "جولة تانية" : "الكلمة اللي بعدها"} color={C.teal}
            onPress={() => act({ type: g.phase === "result" ? "again" : "next" })} />
        ) : <Body muted>المضيف بيكمّل.</Body>}
      </>
    );
  }

  return (
    <Screen>
      <GameTop title="كلمة سر" category="egypt" host={host} onEnd={() => send("endGame")} />
      {scores}
      <ErrorLine text={err} />
      {body}
    </Screen>
  );
}

const st = StyleSheet.create({
  score: { flex: 1, borderWidth: 2, borderRadius: 6, padding: 10, gap: 2 },
  teamName: { fontFamily: F.bold, color: C.wool, fontSize: 14, textAlign: "right" },
  points: { fontFamily: F.head, color: C.amber, fontSize: 26, lineHeight: 40, textAlign: "right" },
  members: { fontFamily: F.body, color: C.muted, fontSize: 12, textAlign: "right" },
  big: { fontFamily: F.head, color: C.wool, fontSize: 32, lineHeight: 50, textAlign: "center" },
});
