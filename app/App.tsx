import { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts, ReemKufi_700Bold } from "@expo-google-fonts/reem-kufi";
import { IBMPlexSansArabic_400Regular, IBMPlexSansArabic_700Bold } from "@expo-google-fonts/ibm-plex-sans-arabic";
import { useRoom } from "./src/net";
import { Home, HowTo, Lobby, Waiting } from "./src/screens";
import { Outsider } from "./src/Outsider";
import { Night } from "./src/Night";
import { Hazzoura } from "./src/Hazzoura";
import { Autobus } from "./src/Autobus";
import { Saraha } from "./src/Saraha";
import { SeenJeem } from "./src/SeenJeem";
import { KelmaSer } from "./src/KelmaSer";
import { C, F } from "./src/ui";

export default function App() {
  const [fonts] = useFonts({ ReemKufi_700Bold, IBMPlexSansArabic_400Regular, IBMPlexSansArabic_700Bold });
  const { state, online, kicked } = useRoom();

  useEffect(() => {
    // Native gets RTL from the expo-localization plugin; the web page needs it set on <html>.
    if (Platform.OS === "web") { document.documentElement.dir = "rtl"; document.documentElement.lang = "ar"; }
  }, []);

  if (!fonts) return <View style={{ flex: 1, backgroundColor: C.ground }} />;

  // iPhone opened in Safari but not yet added to the home screen: show how, once.
  const iosBrowser = Platform.OS === "web" && /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as any).standalone;

  let screen;
  if (!state) screen = <Home kicked={kicked} />;
  else if (state.you.waiting) screen = <Waiting state={state} />;
  else if (!state.game) screen = <Lobby state={state} />;
  else if (state.game.phase === "howto") screen = <HowTo state={state} />;
  else if (state.game.gameId === "outsider") screen = <Outsider state={state} />;
  else if (state.game.gameId === "hazzoura") screen = <Hazzoura state={state} />;
  else if (state.game.gameId === "autobus") screen = <Autobus state={state} />;
  else if (state.game.gameId === "saraha") screen = <Saraha state={state} />;
  else if (state.game.gameId === "seenjeem") screen = <SeenJeem state={state} />;
  else if (state.game.gameId === "kelmaser") screen = <KelmaSer state={state} />;
  else screen = <Night state={state} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <StatusBar style="light" />
      {!online && (
        <Text accessibilityLiveRegion="assertive" style={{ backgroundColor: C.amber, color: C.ground, fontFamily: F.bold, textAlign: "center", padding: 6 }}>
          انقطع الاتصال… نحاول نرجع
        </Text>
      )}
      {screen}
      {iosBrowser && !state && (
        <Text style={{ backgroundColor: C.surface, color: C.wool, fontFamily: F.body, textAlign: "center", padding: 14, paddingBottom: 28, fontSize: 15, lineHeight: 24 }}>
          {"عشان يصير تطبيق على جوالك: اضغط زر المشاركة ⬆︎ تحت، بعدين «إضافة إلى الشاشة الرئيسية»."}
        </Text>
      )}
    </View>
  );
}
