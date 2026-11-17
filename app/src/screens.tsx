import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORIES, Category, GAMES, gameById } from "./content";
import { enter, leave, RoomState, send } from "./net";
import { accent, Band, Body, Btn, C, Card, ErrorLine, F, Field, Row, Screen, Title } from "./ui";

export function Home({ kicked }: { kicked: boolean }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"same" | "remote">("same");
  const [err, setErr] = useState<string | null>(kicked ? "المضيف طلّعك من الغرفة" : null);
  const run = async (event: "create" | "join") => {
    setErr(null);
    const res = await enter(event, event === "create" ? { name, mode } : { name, code });
    if (res.error) setErr(res.error);
  };
  return (
    <Screen>
      <Band />
      <Title size={40}>سهرة</Title>
      <Body muted>ألعاب الجمعة: افتح غرفة، عطهم الرقم، والتطبيق يدير اللعب.</Body>
      <Field label="اسمك" value={name} onChangeText={setName} maxLength={20} placeholder="مثلاً: فهد" autoComplete="name" />
      <ErrorLine text={err} />

      <Card>
        <Title size={22}>افتح غرفة</Title>
        <Row>
          {(["same", "remote"] as const).map((m) => (
            <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: mode === m }} onPress={() => setMode(m)}
              style={[st.choice, mode === m && { borderColor: C.red, backgroundColor: "#2c1715" }]}>
              <Text style={st.choiceText}>{m === "same" ? "كلنا بنفس المكان" : "كل واحد ببيته"}</Text>
            </Pressable>
          ))}
        </Row>
        <Btn label="افتح غرفة جديدة" disabled={!name.trim()} onPress={() => run("create")} />
      </Card>

      <Card>
        <Title size={22}>ادخل غرفة</Title>
        <Field label="رقم الغرفة (٤ أرقام)" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 4))}
          keyboardType="number-pad" inputMode="numeric" maxLength={4} placeholder="0000" style={{ letterSpacing: 8, textAlign: "center", fontSize: 26 }} />
        <Btn label="اطلب الدخول" kind="ghost" disabled={!name.trim() || code.length !== 4} onPress={() => run("join")} />
      </Card>
    </Screen>
  );
}

export function Waiting({ state }: { state: RoomState }) {
  return (
    <Screen>
      <Band />
      <Title>غرفة {state.code}</Title>
      <Card>
        <Body>أرسلنا طلبك يا {state.you.name}.</Body>
        <Body muted>انتظر المضيف يقبلك… خلّ الشاشة مفتوحة.</Body>
      </Card>
      <Btn label="إلغاء" kind="ghost" onPress={leave} />
    </Screen>
  );
}

export function Lobby({ state }: { state: RoomState }) {
  const [cat, setCat] = useState<Category>("saudi");
  const [peek, setPeek] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const host = state.you.isHost;
  const call = async (event: string, data: object) => { setErr(null); const r = await send(event, data); if (r.error) setErr(r.error); };

  return (
    <Screen>
      <Band category={cat} />
      <View style={{ gap: 2 }}>
        <Body muted>رقم الغرفة</Body>
        <Text style={st.code} accessibilityLabel={`رقم الغرفة ${state.code.split("").join(" ")}`}>{state.code}</Text>
        <Body muted>{state.mode === "same" ? "كلكم بنفس المكان" : "كل واحد ببيته"}</Body>
      </View>
      <ErrorLine text={err} />

      {host && !!state.pending?.length && (
        <Card style={{ borderColor: C.amber }}>
          <Title size={20}>يبون يدخلون</Title>
          {state.pending.map((p) => (
            <Row key={p.id} style={{ justifyContent: "space-between" }}>
              <Body style={{ flex: 1 }}>{p.name}</Body>
              <Btn label="اقبل" onPress={() => call("decide", { id: p.id, accept: true })} style={{ minHeight: 44 }} />
              <Btn label="ارفض" kind="ghost" onPress={() => call("decide", { id: p.id, accept: false })} style={{ minHeight: 44 }} />
            </Row>
          ))}
        </Card>
      )}

      <Card>
        <Title size={20}>{`اللاعبين (${state.players?.length ?? 0})`}</Title>
        {state.players?.map((p) => (
          <Row key={p.id} style={{ justifyContent: "space-between", minHeight: 36 }}>
            <Body style={{ flex: 1, opacity: p.connected ? 1 : 0.45 }}>
              {p.name}{p.isHost ? "  · المضيف" : ""}{p.id === state.you.id ? "  · أنت" : ""}{p.connected ? "" : "  · انقطع"}
            </Body>
            {p.score > 0 && <Text style={st.score}>{p.score}</Text>}
            {host && p.id !== state.you.id && (
              <Pressable accessibilityRole="button" accessibilityLabel={`طرد ${p.name}`} onPress={() => call("kick", { id: p.id })} hitSlop={10}>
                <Text style={{ color: C.muted, fontFamily: F.bold }}>طرد</Text>
              </Pressable>
            )}
          </Row>
        ))}
      </Card>

      <Row>
        {CATEGORIES.map((c) => (
          <Pressable key={c.id} accessibilityRole="tab" accessibilityState={{ selected: cat === c.id }} onPress={() => setCat(c.id)}
            style={[st.tab, cat === c.id && { borderColor: accent(c.id), backgroundColor: C.surface }]}>
            <Text style={st.tabText}>{c.name}</Text>
            <Text style={st.tabNote}>{c.note}</Text>
          </Pressable>
        ))}
      </Row>

      {GAMES.filter((g) => g.category === cat).map((g) => (
        <Card key={g.id} style={{ borderRightWidth: 4, borderRightColor: g.ready ? accent(cat) : C.line }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Title size={22}>{g.name}</Title>
            <Text style={st.players}>{g.ready ? g.players : "قريباً"}</Text>
          </Row>
          <Body muted>{g.line}</Body>
          {peek === g.id && g.steps.map((t, i) => <Body key={i}>{`${i + 1}. ${t}`}</Body>)}
          <Row>
            <Btn label={peek === g.id ? "إخفاء الشرح" : "كيف تنلعب؟"} kind="ghost" onPress={() => setPeek(peek === g.id ? null : g.id)} style={{ flex: 1 }} />
            {host && g.ready && <Btn label="العبوها" color={accent(cat)} onPress={() => call("chooseGame", { gameId: g.id })} style={{ flex: 1 }} />}
          </Row>
        </Card>
      ))}
      {!host && <Body muted>المضيف يختار اللعبة.</Body>}
      <Btn label="اطلع من الغرفة" kind="danger" onPress={leave} />
    </Screen>
  );
}

export function HowTo({ state }: { state: RoomState }) {
  const g = state.game;
  const info = gameById(g.gameId);
  const done: string[] = g.understood;
  const me = done.includes(state.you.id);
  const waitingFor = state.players?.filter((p) => g.ids.includes(p.id) && !done.includes(p.id)).map((p) => p.name) ?? [];
  return (
    <Screen>
      <Band category={info.category} />
      <Body muted>كيف تنلعب</Body>
      <Title size={34}>{info.name}</Title>
      <Card><Body>{info.line}</Body></Card>
      {info.steps.map((t, i) => (
        <Row key={i} style={{ alignItems: "flex-start" }}>
          <Text style={[st.step, { color: accent(info.category) }]}>{i + 1}</Text>
          <Body style={{ flex: 1 }}>{t}</Body>
        </Row>
      ))}
      {g.playing ? (
        <Btn label={me ? "تمام، ننتظر الباقين" : "فهمت"} disabled={me} color={accent(info.category)} onPress={() => send("understood")} />
      ) : <Body muted>الجولة بدأت، بتدخل الجولة الجاية.</Body>}
      {waitingFor.length > 0 && <Body muted>{`ننتظر: ${waitingFor.join("، ")}`}</Body>}
      {state.you.isHost && <Btn label="ابدأ الحين بدون انتظار" kind="ghost" onPress={() => send("skipHowto")} />}
    </Screen>
  );
}

const st = StyleSheet.create({
  code: { fontFamily: F.head, color: C.wool, fontSize: 64, lineHeight: 90, letterSpacing: 10, textAlign: "right" },
  choice: { flex: 1, minHeight: 52, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, alignItems: "center", justifyContent: "center", padding: 8 },
  choiceText: { fontFamily: F.bold, color: C.wool, fontSize: 15, textAlign: "center" },
  tab: { flex: 1, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, padding: 12, gap: 2 },
  tabText: { fontFamily: F.head, color: C.wool, fontSize: 19, textAlign: "right" },
  tabNote: { fontFamily: F.body, color: C.muted, fontSize: 13, textAlign: "right" },
  players: { fontFamily: F.bold, color: C.muted, fontSize: 13 },
  score: { fontFamily: F.head, color: C.amber, fontSize: 20 },
  step: { fontFamily: F.head, fontSize: 24, width: 26, textAlign: "center" },
});
