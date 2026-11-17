// أتوبيس كومبليت: big letter, 7 boxes saved as you type, STOP button, then 👎 review and points.
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { AUTOBUS_CATS } from "./content";
import { RoomState, send } from "./net";
import { Body, Btn, C, Card, ErrorLine, F, Field, GameTop, Row, Screen, Title, useCountdown } from "./ui";

export function Autobus({ state }: { state: RoomState }) {
  const g = state.game;
  const host = state.you.isHost;
  const me = state.you.id;
  const cats: string[] = g.cats;
  const [mine, setMine] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const act = async (data: object) => { setErr(null); const r = await send("action", data); if (r.error) setErr(r.error); };
  const name = (id: string) => state.players?.find((p) => p.id === id)?.name ?? "؟";
  const left = useCountdown(g.msLeft, `${g.round}-${g.stopped}`, () => { if (g.phase === "write") send("action", { type: "timeup" }); });
  const locked = g.phase === "write" && g.stopped && left === 0;

  // New letter: start from what the server has (after a refresh) or empty boxes.
  useEffect(() => { setMine(g.mine ?? {}); }, [g.round]); // eslint-disable-line react-hooks/exhaustive-deps
  // Save while typing, at most every 400 ms.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (g.phase !== "write") return;
    const t = setTimeout(() => send("action", { type: "save", answers: mine }), 400);
    return () => clearTimeout(t);
  }, [mine]); // eslint-disable-line react-hooks/exhaustive-deps

  const full = cats.every((c) => mine[c]?.trim());
  const ranking = [...(state.players ?? [])].filter((p) => g.ids.includes(p.id)).sort((a, b) => (g.total[b.id] || 0) - (g.total[a.id] || 0));
  const letterBox = (
    <Row style={{ justifyContent: "space-between" }}>
      <Body muted>{`الحرف ${g.round + 1} من ${g.rounds}`}</Body>
      <Text style={st.letter} accessibilityLabel={`الحرف ${g.letter}`}>{g.letter}</Text>
    </Row>
  );

  let body;
  if (!g.playing) body = <Card><Body>الجولة شغالة، هتدخل الجولة الجاية.</Body></Card>;
  else if (g.phase === "write") {
    body = (
      <>
        {letterBox}
        <Card style={{ borderColor: g.stopped ? C.amber : C.line, paddingVertical: 10 }}>
          <Text style={[st.status, g.stopped && { color: C.amber }]}>
            {g.stopped ? `${name(g.stoppedBy)} قال أتوبيس كومبليت! ${left ?? ""}` : `باقي ${left ?? ""} ثانية`}
          </Text>
        </Card>
        {cats.map((c) => (
          <Field key={c} label={AUTOBUS_CATS[c]} value={mine[c] ?? ""} editable={!locked} maxLength={24} autoCorrect={false}
            placeholder={`بـ ${g.letter}`} onChangeText={(t) => setMine((m) => ({ ...m, [c]: t }))} />
        ))}
        <Btn label="أتوبيس كومبليت!" color={C.teal} disabled={!full || g.stopped}
          onPress={async () => { await send("action", { type: "save", answers: mine }); await act({ type: "stop" }); }} />
        {host && <Btn label="وقّف الجولة وراجعوا" kind="ghost" onPress={() => act({ type: "score" })} />}
      </>
    );
  } else if (g.phase === "review" || g.phase === "score") {
    const scoring = g.phase === "score";
    body = (
      <>
        {letterBox}
        <Body muted>{scoring ? "النقط: لوحدك = ١٠ · زي حد تاني = ٥ · غلط أو فاضي = ٠" : "دوس 👎 على أي كلمة مضروبة. لو أكتر من نص الباقيين داسوا، متتحسبش."}</Body>
        {cats.map((c) => (
          <Card key={c}>
            <Title size={18}>{AUTOBUS_CATS[c]}</Title>
            {g.ids.map((id: string) => {
              const text = g.answers[id]?.[c];
              const k = `${id}|${c}`;
              const d = g.downs[k] ?? { n: 0, mine: false };
              return (
                <Row key={id} style={{ justifyContent: "space-between", minHeight: 40 }}>
                  <Body style={{ flex: 1 }}>{`${name(id)}: ${text || "—"}${g.wrongLetter[k] ? `  (مش بـ ${g.letter})` : ""}`}</Body>
                  {scoring ? <Text style={st.pts}>{g.points[id]?.[c] ?? 0}</Text> : text && id !== me ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`كلمة مضروبة: ${text}`} accessibilityState={{ selected: d.mine }}
                      onPress={() => act({ type: "down", id, cat: c })} hitSlop={8}
                      style={[st.down, d.mine && { borderColor: C.red, backgroundColor: "#2c1715" }]}>
                      <Text style={st.downText}>{`👎 ${d.n || ""}`}</Text>
                    </Pressable>
                  ) : d.n ? <Text style={st.downText}>{`👎 ${d.n}`}</Text> : null}
                </Row>
              );
            })}
          </Card>
        ))}
        {scoring && (
          <Card>
            <Title size={20}>المجموع</Title>
            {ranking.map((p) => (
              <Row key={p.id} style={{ justifyContent: "space-between" }}>
                <Body style={{ flex: 1 }}>{p.name}</Body>
                <Text style={st.pts}>{g.total[p.id] || 0}</Text>
              </Row>
            ))}
          </Card>
        )}
        {host ? (
          <Btn label={scoring ? (g.round + 1 < g.rounds ? "الحرف اللي بعده" : "النتيجة") : "احسب النقط"} color={C.teal}
            onPress={() => act({ type: scoring ? "next" : "score" })} />
        ) : <Body muted>المضيف بيكمّل.</Body>}
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
              <Text style={st.pts}>{g.total[p.id] || 0}</Text>
            </Row>
          ))}
        </Card>
        {host ? <Btn label="جولة تانية" color={C.teal} onPress={() => act({ type: "again" })} /> : <Body muted>المضيف بيقرر.</Body>}
      </>
    );
  }

  return (
    <Screen>
      <GameTop title="أتوبيس كومبليت" category="egypt" host={host} onEnd={() => send("endGame")} />
      <ErrorLine text={err} />
      {body}
    </Screen>
  );
}

const st = StyleSheet.create({
  letter: { fontFamily: F.head, color: C.amber, fontSize: 64, lineHeight: 90, minWidth: 80, textAlign: "center" },
  status: { fontFamily: F.bold, color: C.wool, fontSize: 17, textAlign: "center" },
  pts: { fontFamily: F.head, color: C.amber, fontSize: 20, minWidth: 34, textAlign: "center" },
  down: { minWidth: 52, minHeight: 36, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  downText: { fontFamily: F.bold, color: C.wool, fontSize: 14 },
});
