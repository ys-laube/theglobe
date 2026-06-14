export type Capital = {
  id: string;
  city: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  tier: 'highlight' | 'explore';
  landmark: string;
  food: string;
  note: string;
  link: string;
  accent: string;
};

export const capitals: Capital[] = [
  { id:'seoul', city:'서울', country:'대한민국', region:'Asia', lat:37.5665, lng:126.9780, tier:'highlight', landmark:'경복궁과 N서울타워', food:'비빔밥과 떡볶이', note:'출발점은 한국, 시선은 언제나 세계로.', link:'https://ko.wikipedia.org/wiki/%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C', accent:'#7dd3fc' },
  { id:'tokyo', city:'도쿄', country:'일본', region:'Asia', lat:35.6762, lng:139.6503, tier:'highlight', landmark:'도쿄타워와 센소지', food:'스시와 라멘', note:'전통과 미래가 한 화면에 겹쳐지는 도시.', link:'https://en.wikipedia.org/wiki/Tokyo', accent:'#f9a8d4' },
  { id:'beijing', city:'베이징', country:'중국', region:'Asia', lat:39.9042, lng:116.4074, tier:'explore', landmark:'자금성과 만리장성', food:'베이징 카오야', note:'긴 역사 위에 거대한 내일을 짓는 수도.', link:'https://en.wikipedia.org/wiki/Beijing', accent:'#f87171' },
  { id:'bangkok', city:'방콕', country:'태국', region:'Asia', lat:13.7563, lng:100.5018, tier:'explore', landmark:'왕궁과 왓 아룬', food:'팟타이와 망고스티키라이스', note:'빛나는 사원과 활기찬 거리의 리듬.', link:'https://en.wikipedia.org/wiki/Bangkok', accent:'#fbbf24' },
  { id:'hanoi', city:'하노이', country:'베트남', region:'Asia', lat:21.0278, lng:105.8342, tier:'explore', landmark:'호안끼엠 호수', food:'쌀국수', note:'호수와 오토바이, 오래된 골목이 만드는 에너지.', link:'https://en.wikipedia.org/wiki/Hanoi', accent:'#34d399' },
  { id:'singapore', city:'싱가포르', country:'싱가포르', region:'Asia', lat:1.3521, lng:103.8198, tier:'highlight', landmark:'마리나 베이 샌즈', food:'칠리크랩과 카야토스트', note:'작은 섬에서 세계의 허브로 성장한 도시국가.', link:'https://en.wikipedia.org/wiki/Singapore', accent:'#5eead4' },
  { id:'newdelhi', city:'뉴델리', country:'인도', region:'Asia', lat:28.6139, lng:77.2090, tier:'explore', landmark:'인디아 게이트', food:'버터치킨과 난', note:'다채로운 색과 향이 겹쳐지는 거대한 관문.', link:'https://en.wikipedia.org/wiki/New_Delhi', accent:'#fb923c' },
  { id:'riyadh', city:'리야드', country:'사우디아라비아', region:'Asia', lat:24.7136, lng:46.6753, tier:'explore', landmark:'킹덤 센터', food:'캅사', note:'사막 위에 솟은 미래형 스카이라인.', link:'https://en.wikipedia.org/wiki/Riyadh', accent:'#facc15' },
  { id:'london', city:'런던', country:'영국', region:'Europe', lat:51.5072, lng:-0.1276, tier:'highlight', landmark:'빅벤과 타워브리지', food:'피시 앤 칩스', note:'오래된 왕국과 글로벌 문화가 만나는 무대.', link:'https://en.wikipedia.org/wiki/London', accent:'#93c5fd' },
  { id:'paris', city:'파리', country:'프랑스', region:'Europe', lat:48.8566, lng:2.3522, tier:'highlight', landmark:'에펠탑과 루브르', food:'크루아상과 마카롱', note:'예술과 빛으로 세계를 초대하는 도시.', link:'https://en.wikipedia.org/wiki/Paris', accent:'#c4b5fd' },
  { id:'rome', city:'로마', country:'이탈리아', region:'Europe', lat:41.9028, lng:12.4964, tier:'highlight', landmark:'콜로세움과 판테온', food:'카르보나라와 젤라토', note:'고대의 길 위에서 현재가 계속 피어난다.', link:'https://en.wikipedia.org/wiki/Rome', accent:'#fdba74' },
  { id:'madrid', city:'마드리드', country:'스페인', region:'Europe', lat:40.4168, lng:-3.7038, tier:'explore', landmark:'프라도 미술관', food:'타파스와 초콜라테 콘 추로스', note:'태양과 예술, 축구의 열기가 살아있는 수도.', link:'https://en.wikipedia.org/wiki/Madrid', accent:'#fda4af' },
  { id:'berlin', city:'베를린', country:'독일', region:'Europe', lat:52.52, lng:13.405, tier:'explore', landmark:'브란덴부르크 문', food:'커리부어스트', note:'역사를 기억하며 새로운 문화를 실험하는 도시.', link:'https://en.wikipedia.org/wiki/Berlin', accent:'#d1d5db' },
  { id:'vienna', city:'빈', country:'오스트리아', region:'Europe', lat:48.2082, lng:16.3738, tier:'explore', landmark:'쇤브룬 궁전', food:'자허토르테', note:'음악과 궁전의 우아함이 남아있는 수도.', link:'https://en.wikipedia.org/wiki/Vienna', accent:'#fde68a' },
  { id:'athens', city:'아테네', country:'그리스', region:'Europe', lat:37.9838, lng:23.7275, tier:'explore', landmark:'파르테논 신전', food:'수블라키', note:'문명의 오래된 질문들이 시작된 언덕.', link:'https://en.wikipedia.org/wiki/Athens', accent:'#bfdbfe' },
  { id:'oslo', city:'오슬로', country:'노르웨이', region:'Europe', lat:59.9139, lng:10.7522, tier:'explore', landmark:'오페라 하우스', food:'연어 요리', note:'피오르드의 고요함과 북유럽 디자인.', link:'https://en.wikipedia.org/wiki/Oslo', accent:'#bae6fd' },
  { id:'washington', city:'워싱턴 D.C.', country:'미국', region:'North America', lat:38.9072, lng:-77.0369, tier:'highlight', landmark:'링컨 기념관과 국회의사당', food:'체서피크 크랩 케이크', note:'결정의 언어가 세계로 퍼져나가는 수도.', link:'https://en.wikipedia.org/wiki/Washington,_D.C.', accent:'#bfdbfe' },
  { id:'ottawa', city:'오타와', country:'캐나다', region:'North America', lat:45.4215, lng:-75.6972, tier:'explore', landmark:'팔러먼트 힐', food:'푸틴과 메이플 디저트', note:'강과 눈, 이중 언어가 만나는 차분한 수도.', link:'https://en.wikipedia.org/wiki/Ottawa', accent:'#fca5a5' },
  { id:'mexico-city', city:'멕시코시티', country:'멕시코', region:'North America', lat:19.4326, lng:-99.1332, tier:'highlight', landmark:'소칼로와 국립인류학박물관', food:'타코와 몰레', note:'고대 문명과 현대 예술이 층층이 쌓인 대도시.', link:'https://en.wikipedia.org/wiki/Mexico_City', accent:'#86efac' },
  { id:'havana', city:'아바나', country:'쿠바', region:'North America', lat:23.1136, lng:-82.3666, tier:'explore', landmark:'올드 아바나', food:'로파 비에하', note:'색채와 음악이 해안 바람에 실려오는 도시.', link:'https://en.wikipedia.org/wiki/Havana', accent:'#67e8f9' },
  { id:'brasilia', city:'브라질리아', country:'브라질', region:'South America', lat:-15.7939, lng:-47.8828, tier:'explore', landmark:'브라질리아 대성당', food:'페이조아다', note:'미래 도시를 꿈꾸며 설계된 수도.', link:'https://en.wikipedia.org/wiki/Bras%C3%ADlia', accent:'#bef264' },
  { id:'buenosaires', city:'부에노스아이레스', country:'아르헨티나', region:'South America', lat:-34.6037, lng:-58.3816, tier:'highlight', landmark:'오벨리스코와 라 보카', food:'아사도와 엠파나다', note:'탱고처럼 우아하고 강렬한 남미의 리듬.', link:'https://en.wikipedia.org/wiki/Buenos_Aires', accent:'#f0abfc' },
  { id:'lima', city:'리마', country:'페루', region:'South America', lat:-12.0464, lng:-77.0428, tier:'explore', landmark:'마요르 광장', food:'세비체', note:'태평양과 안데스의 맛이 만나는 관문.', link:'https://en.wikipedia.org/wiki/Lima', accent:'#fde047' },
  { id:'santiago', city:'산티아고', country:'칠레', region:'South America', lat:-33.4489, lng:-70.6693, tier:'explore', landmark:'산 크리스토발 언덕', food:'파스텔 데 초클로', note:'안데스 산맥 아래 길게 뻗은 나라의 중심.', link:'https://en.wikipedia.org/wiki/Santiago', accent:'#a5b4fc' },
  { id:'bogota', city:'보고타', country:'콜롬비아', region:'South America', lat:4.7110, lng:-74.0721, tier:'explore', landmark:'몬세라테 언덕', food:'아히아코', note:'고원 위에서 커피 향과 예술이 어우러진 도시.', link:'https://en.wikipedia.org/wiki/Bogot%C3%A1', accent:'#fcd34d' },
  { id:'cairo', city:'카이로', country:'이집트', region:'Africa', lat:30.0444, lng:31.2357, tier:'highlight', landmark:'피라미드와 이집트 박물관', food:'코샤리', note:'나일강과 고대 문명이 오늘을 비추는 수도.', link:'https://en.wikipedia.org/wiki/Cairo', accent:'#fde68a' },
  { id:'nairobi', city:'나이로비', country:'케냐', region:'Africa', lat:-1.2921, lng:36.8219, tier:'highlight', landmark:'나이로비 국립공원', food:'냐마 초마', note:'도시와 야생이 가까이 만나는 특별한 수도.', link:'https://en.wikipedia.org/wiki/Nairobi', accent:'#86efac' },
  { id:'capetown', city:'케이프타운', country:'남아프리카공화국', region:'Africa', lat:-33.9249, lng:18.4241, tier:'explore', landmark:'테이블 마운틴', food:'보보티', note:'바다와 산이 만든 극적인 풍경의 도시.', link:'https://en.wikipedia.org/wiki/Cape_Town', accent:'#7dd3fc' },
  { id:'rabat', city:'라바트', country:'모로코', region:'Africa', lat:34.0209, lng:-6.8416, tier:'explore', landmark:'하산 탑', food:'타진', note:'대서양 바람과 북아프리카의 문양이 만나는 곳.', link:'https://en.wikipedia.org/wiki/Rabat', accent:'#fb7185' },
  { id:'addisababa', city:'아디스아바바', country:'에티오피아', region:'Africa', lat:8.9806, lng:38.7578, tier:'explore', landmark:'국립박물관', food:'인제라', note:'높은 고원 위 아프리카 외교의 중심.', link:'https://en.wikipedia.org/wiki/Addis_Ababa', accent:'#fbbf24' },
  { id:'canberra', city:'캔버라', country:'호주', region:'Oceania', lat:-35.2809, lng:149.1300, tier:'explore', landmark:'국회의사당', food:'미트파이와 라밍턴', note:'넓은 대륙의 차분한 행정 중심.', link:'https://en.wikipedia.org/wiki/Canberra', accent:'#93c5fd' },
  { id:'wellington', city:'웰링턴', country:'뉴질랜드', region:'Oceania', lat:-41.2865, lng:174.7762, tier:'highlight', landmark:'테 파파 박물관', food:'파블로바', note:'바람과 항구, 창작 에너지가 모이는 작은 수도.', link:'https://en.wikipedia.org/wiki/Wellington', accent:'#99f6e4' },
  { id:'suva', city:'수바', country:'피지', region:'Oceania', lat:-18.1248, lng:178.4501, tier:'explore', landmark:'피지 박물관', food:'코코다', note:'남태평양의 푸른 바다와 섬 문화.', link:'https://en.wikipedia.org/wiki/Suva', accent:'#38bdf8' }
];
