import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { View } from "react-native";

export default function ABanner() {
  return (
    <View>
      {
        <BannerAd
          //unitId={"ca-app-pub-3818927199662677/3221934793"}
          unitId={"ca-app-pub-3940256099942544/9214589741"}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        />
      }
    </View>
  );
}
