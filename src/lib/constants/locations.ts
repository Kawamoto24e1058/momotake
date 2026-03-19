export interface Location {
  id: string;
  name: string;
  category: 'shop' | 'campus_building';
  lat: number;
  lng: number;
}

export const locations: Location[] = [
  // Convenience Stores (和泉中央駅周辺)
  { id: 'seven_eleven_station', name: 'セブンイレブン 南海和泉中央駅店', category: 'shop', lat: 34.461133, lng: 135.456006 },
  { id: 'lawson_karagunicho', name: 'ローソン 和泉唐国店', category: 'shop', lat: 34.460038, lng: 135.449173 },
  { id: 'family_mart_karagunicho', name: 'ファミリーマート 和泉唐国店', category: 'shop', lat: 34.454683, lng: 135.45198 },
  
  // McDonald's
  { id: 'mcdonalds_izumi_chuo', name: 'マクドナルド 和泉中央店', category: 'shop', lat: 34.459412, lng: 135.459911 },

  // University Buildings (桃山学院大学)
  { id: 'momoyama_building_1', name: '桃山学院大学 1号館', category: 'campus_building', lat: 34.450921, lng: 135.455558 },
  { id: 'momoyama_building_2', name: '桃山学院大学 2号館', category: 'campus_building', lat: 34.451100, lng: 135.455800 },
  { id: 'momoyama_building_3', name: '桃山学院大学 3号館', category: 'campus_building', lat: 34.450700, lng: 135.455300 },
];
