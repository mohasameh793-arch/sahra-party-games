// المافيا + الذيب. At night EVERY phone shows the same list, so nobody can tell from a
// neighbour's screen who is acting; only the hold-card says what your tap really does.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ROLES, TALK } from "./content";
import { RoomState, send } from "./net";
import { accent, Band, Body, Btn, C, Card, ErrorLine, F, HoldCard, Row, Screen, Title } from "./ui";

type News = { kind: "night" | "vote" | "hunter"; id: string | null; role?: string; saved?: boolean };

export function Night({ state }: { state: RoomState }) {
  const g = state.game;
  const gameId = g.gameId as "mafia" | "dheeb";
  const T = TALK[gameId];
  const cat = "saudi"; // both night games (المافيا, الذيب) are in the Saudi category
  const color = accent(cat);
  const meId = state.you.id;
  const host = state.you.isHost;
  const [err, setErr] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [localPick, setLocalPick] = useState<string | null>(null);
  useEffect(() => { setLocalPick(null); if (g.phase !== "reveal") setHeld(false); }, [g.phase, g.round]);

  const act = async (data: object) => { setErr(null); const r = await send("action", data); if (r.error) setErr(r.error); };
  const name = (id: string) => state.players?.find((p) => p.id === id)?.name ?? "؟";
  const role = g.role ? ROLES[g.role] : null;
  const amAlive = g.alive.includes(meId);
  const others = g.alive.filter((id: string) => id !== meId);

  const newsLine = (n: News) => {
    if (n.kind === "night") return n.id ? T.nightKill(name(n.id)) : n.saved ? T.nightSaved : T.nightNone;
    if (n.kind === "vote") return n.id ? T.voteOut(name(n.id)) : T.voteNone;
    return T.shot(name(n.id!));
  };
  const newsCards = (g.news as News[]).map((n, i) => (
    <Card key={i} style={{ borderColor: n.id ? color : C.line }}>
      <Text style={st.news}>{newsLine(n)}</Text>
      {n.id && n.role && <Body muted>{`كان: ${ROLES[n.role].name}`}</Body>}
    </Card>
  ));

  const card = role && (
    <HoldCard color={color} onSeen={() => setHeld(true)}>
      <View style={{ gap: 8, alignSelf: "stretch" }}>
        <Body muted style={{ textAlign: "center" }}>دورك</Body>
        <Text style={st.big}>{role.name}</Text>
        <Body style={{ textAlign: "center" }}>{role.what}</Body>
        {g.phase === "night" && role.night && <Text style={[st.prompt, { color }]}>{role.night}</Text>}
        {g.team && <Body muted style={{ textAlign: "center" }}>{`${T.team}: ${g.team.filter((id: string) => id !== meId).map(name).join("، ") || "لحالك"}`}</Body>}
        {g.teamPicks && Object.entries(g.teamPicks).filter(([id]) => id !== meId).map(([id, t]) => (
          <Body key={id} muted style={{ textAlign: "center" }}>{`${name(id)} اختار ${name(t as string)}`}</Body>
        ))}
        {g.checks?.map((c: { id: string; result: string }, i: number) => (
          <Body key={i} style={{ textAlign: "center" }}>{`${name(c.id)}: ${ROLES[c.result].name}`}</Body>
        ))}
      </View>
    </HoldCard>
  );

  // Every phone lists the same living players (a shorter list would expose a wolf to a peeking neighbour).
  // Taps the role may not make are ignored quietly; the server enforces the same rules.
  const allowed = (id: string) => {
    if (g.role === "mafia" || g.role === "wolf") return !g.team.includes(id);
    if (g.role === "doctor" || g.role === "guard") return id !== g.lastProtect;
    return id !== meId;
  };
  const acts = !!role?.night;
  const picked = acts ? g.myPick : localPick;

  let body = null;
  if (!g.playing) body = <Card><Body>الجولة شغالة، بتدخل الجولة الجاية.</Body></Card>;
  else if (g.phase === "reveal") {
    const seen = g.seen.includes(meId);
    body = (
      <>
        {card}
        <Btn label={seen ? "تمام، ننتظر الباقين" : "شفت دوري"} color={color} disabled={seen || !held} onPress={() => act({ type: "seen" })} />
        <Body muted>{`${g.seen.length} من ${g.ids.length} شافوا أدوارهم`}</Body>
      </>
    );
  } else if (g.phase === "night") {
    body = (
      <>
        <Title size={24}>{T.sleep}</Title>
        {amAlive ? (
          <>
            <Body muted>{T.pickHint}</Body>
            {card}
            {g.alive.map((id: string) => (
              <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: picked === id }}
                onPress={() => { if (!allowed(id)) return; if (acts) act({ type: "night", targetId: id }); else setLocalPick(id); }}
                style={[st.pick, picked === id && { borderColor: color, backgroundColor: "#2a1d1a" }]}>
                <Text style={st.pickText}>{id === meId ? `${name(id)} (أنت)` : name(id)}</Text>
              </Pressable>
            ))}
            <Body muted>{T.keepHint}</Body>
          </>
        ) : <Card><Body>{T.deadNote}</Body></Card>}
        {host && <Btn label="كمّل الليل (لو أحد علّق)" kind="ghost" onPress={() => act({ type: "force" })} />}
      </>
    );
  } else if (g.phase === "hunter") {
    body = (
      <>
        {newsCards}
        {g.hunterId === meId ? (
          <>
            <Title size={24}>{T.shootPick}</Title>
            {others.map((id: string) => (
              <Pressable key={id} accessibilityRole="button" onPress={() => act({ type: "shoot", targetId: id })} style={st.pick}>
                <Text style={st.pickText}>{name(id)}</Text>
              </Pressable>
            ))}
          </>
        ) : <Card><Text style={st.news}>{T.hunterTurn(name(g.hunterId))}</Text></Card>}
        {host && g.hunterId !== meId && <Btn label="كمّل بدون رمية (لو علّق)" kind="ghost" onPress={() => act({ type: "force" })} />}
      </>
    );
  } else if (g.phase === "day") {
    body = (
      <>
        <Body muted>{`الصبح · اليوم ${g.round}`}</Body>
        {newsCards}
        <Title size={24}>{T.discuss}</Title>
        {!amAlive && <Card><Body>{T.deadNote}</Body></Card>}
        {amAlive && card}
        {host ? <Btn label="خلّصنا نقاش، للتصويت" color={color} onPress={() => act({ type: "toVote" })} /> : <Body muted>المضيف يفتح التصويت.</Body>}
      </>
    );
  } else if (g.phase === "vote") {
    body = amAlive ? (
      <>
        <Title size={24}>{T.voteQ}</Title>
        {[...others, null].map((id: string | null) => (
          <Pressable key={id ?? "none"} accessibilityRole="radio" accessibilityState={{ checked: g.myVote === id }}
            onPress={() => act({ type: "vote", targetId: id })}
            style={[st.pick, g.myVote === id && { borderColor: color, backgroundColor: "#2a1d1a" }, id === null && { borderStyle: "dashed" }]}>
            <Text style={st.pickText}>{id ? name(id) : T.nobody}</Text>
          </Pressable>
        ))}
        <Body muted>{`${g.voted.length} من ${g.alive.length} صوّتوا`}</Body>
        {host && <Btn label="سكّر التصويت الحين" kind="ghost" onPress={() => act({ type: "force" })} />}
      </>
    ) : (
      <><Card><Body>{T.deadNote}</Body></Card><Body muted>{`${g.voted.length} من ${g.alive.length} صوّتوا`}</Body></>
    );
  } else if (g.phase === "verdict") {
    body = (
      <>
        {newsCards}
        <Card>
          <Title size={20}>مين صوّت على مين</Title>
          {Object.entries(g.votes ?? {}).map(([v, t]) => <Body key={v}>{`${name(v)} ← ${t ? name(t as string) : T.nobody}`}</Body>)}
        </Card>
        {host ? <Btn label="جا الليل" color={color} onPress={() => act({ type: "toNight" })} /> : <Body muted>المضيف يبدأ الليل.</Body>}
      </>
    );
  } else if (g.phase === "result") {
    const won = (g.winner === "evil") === !!role?.evil;
    body = (
      <>
        {newsCards}
        <Card style={{ borderColor: color }}>
          <Text style={st.big}>{g.winner === "evil" ? T.winEvil : T.winTown}</Text>
          <Body style={{ textAlign: "center" }}>{won ? "فريقك فاز (+١)" : "فريقك خسر"}</Body>
        </Card>
        <Card>
          <Title size={20}>الأدوار</Title>
          {[...(state.players ?? [])].filter((p) => g.ids.includes(p.id)).sort((a, b) => b.score - a.score).map((p) => (
            <Row key={p.id} style={{ justifyContent: "space-between" }}>
              <Body style={{ flex: 1 }}>{`${p.name} — ${ROLES[g.roles[p.id]].name}${g.alive.includes(p.id) ? "" : " · طلع"}`}</Body>
              <Text style={st.score}>{p.score}</Text>
            </Row>
          ))}
        </Card>
        {host ? <Btn label="جولة ثانية" color={color} onPress={() => act({ type: "again" })} /> : <Body muted>المضيف يقرر الجولة الجاية.</Body>}
      </>
    );
  }

  return (
    <Screen>
      <Band category={cat} />
      <Row style={{ justifyContent: "space-between" }}>
        <Title size={26}>{T.title}</Title>
        {host && <Pressable accessibilityRole="button" onPress={() => send("endGame")} hitSlop={10}><Text style={st.end}>إنهاء اللعبة</Text></Pressable>}
      </Row>
      <Body muted>{`باقي ${g.alive.length} لاعبين`}</Body>
      <ErrorLine text={err} />
      {body}
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { fontFamily: F.head, color: C.wool, fontSize: 34, lineHeight: 52, textAlign: "center" },
  prompt: { fontFamily: F.bold, fontSize: 18, textAlign: "center" },
  news: { fontFamily: F.head, color: C.wool, fontSize: 22, lineHeight: 34, textAlign: "right" },
  pick: { minHeight: 56, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, justifyContent: "center", paddingHorizontal: 16, backgroundColor: C.surface },
  pickText: { fontFamily: F.bold, color: C.wool, fontSize: 18, textAlign: "right" },
  score: { fontFamily: F.head, color: C.amber, fontSize: 20, minWidth: 30, textAlign: "center" },
  end: { fontFamily: F.bold, color: C.muted, fontSize: 14 },
});
