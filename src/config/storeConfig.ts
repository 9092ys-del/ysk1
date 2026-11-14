import heroCarrotCakeImg from '../assets/images/hero_carrot_cake_1794636275742.jpg';
import storyCarrotCakeImg from '../assets/images/story_carrot_cake_1794636276902.jpg';
import americanoImg from '../assets/images/menu_americano_dark_1794638830603.jpg';
import cafeLatteImg from '../assets/images/menu_cafe_latte_dark_1794638831367.jpg';
import vanillaLatteImg from '../assets/images/menu_vanilla_latte_dark_1794638831670.jpg';
import caramelMacchiatoImg from '../assets/images/menu_caramel_macchiato_dark_1794638833402.jpg';
import matchaLatteImg from '../assets/images/menu_matcha_latte_dark_1794638832065.jpg';
import chocoLatteImg from '../assets/images/menu_choco_latte_dark_1794638834344.jpg';
import lemonadeImg from '../assets/images/menu_lemonade_dark_1794638834026.jpg';
import peachIcedTeaImg from '../assets/images/menu_peach_iced_tea_dark_1794638834165.jpg';

export interface MenuItem {
  id: string;
  name: string;
  englishName: string;
  category: 'coffee' | 'beverage';
  options: ('ICE' | 'HOT')[];
  /**
   * 매장 가격표 확인 후 입력 (미확정 시 null 유지 — 임의 가격 표기 금지)
   */
  priceKrw: number | null;
  description: string;
  imageUrl: string;
  imageAlt: string;
}

export interface StoreConfig {
  brandName: string;
  newMenu: {
    name: string;
    englishName: string;
    mainCopy: string;
    subCopy: string;
    auxCopy: string;
    originNote: string;
    sweetnessNote: string;
    priceKrw: number | null;
    heroImageUrl: string;
    storyImageUrl: string;
  };
  promotion: {
    couponType: 'NEW_CARROT_CAKE_AMERICANO';
    title: string;
    targetAudience: string;
    condition: string;
    benefitLabel: string;
    /**
     * PRD 13장 기준 권장안(7일/14일) 중 기본 설정값 — 매장 확정 시 조정 가능
     */
    validityDays: number;
    validityNote: string;
    americanoOptionNote: string;
    stackingNote: string;
  };
  /**
   * PRD 5.6 & 13장 준수: 미확정 매장 정보는 임의로 만들지 않고 null/미정 상태로 관리
   */
  storeInfo: {
    address: string | null;
    mapUrl: string | null;
    businessHours: string | null;
    phone: string | null;
    parkingGuide: string | null;
  };
  /**
   * PRD 13장 기준 Bootstrapped Admin 이메일
   */
  bootstrappedAdminEmail: string;
}

export const STORE_CONFIG: StoreConfig = {
  brandName: '아이콘카페',
  newMenu: {
    name: '제주 구좌 유기농 당근케이크',
    englishName: 'Jeju Gujwa Organic Carrot Cake',
    mainCopy: '건강한 달콤함을 만나다.',
    subCopy:
      '제주 구좌 유기농 당근과 자연이 선물한 달콤함. 설탕을 넣지 않고 당근과 과일 본연의 단맛으로 완성했습니다.',
    auxCopy: '오늘의 디저트는 조금 더 산뜻하게.',
    originNote: '제주 구좌읍에서 자란 유기농 당근을 곱게 갈아 굽고, 부드러운 크림치즈 프로스팅을 얹었습니다.',
    sweetnessNote:
      '인위적인 설탕 첨가 대신, 구좌 당근과 엄선된 과일 본연의 은은한 단맛을 조화롭게 담아내어 부담 없이 즐기기 좋습니다.',
    priceKrw: null,
    heroImageUrl: heroCarrotCakeImg,
    storyImageUrl: storyCarrotCakeImg,
  },
  promotion: {
    couponType: 'NEW_CARROT_CAKE_AMERICANO',
    title: '첫 방문 고객 신메뉴 프로모션',
    targetAudience: '아이콘카페 첫 방문 고객',
    condition: '신메뉴 제주 구좌 유기농 당근케이크 구매 시',
    benefitLabel: '아메리카노 1잔 무료',
    validityDays: 14,
    validityNote: '발급일로부터 14일 이내 사용 (최종 운영 기준에 따라 매장 안내 적용)',
    americanoOptionNote: '기본 아메리카노 제공 (사이즈 및 ICE/HOT 세부 기준은 매장 안내에 따름)',
    stackingNote: '1인 1회 매장 직원 확인 후 사용 가능 · 타 할인 중복 여부는 매장 기준 적용',
  },
  storeInfo: {
    address: '계원예술대',
    mapUrl: 'https://map.naver.com/p/search/%EA%B3%84%EC%9B%90%EC%98%88%EC%88%A0%EB%8C%80',
    businessHours: '오전10시~15시, 오후17시~21시',
    phone: null,
    parkingGuide: null,
  },
  bootstrappedAdminEmail: '9092ys@gmail.com',
};

export const BASIC_MENU_ITEMS: MenuItem[] = [
  {
    id: 'americano',
    name: '아메리카노',
    englishName: 'Americano',
    category: 'coffee',
    options: ['ICE', 'HOT'],
    priceKrw: null,
    description: '깔끔한 산미와 고소한 바디감이 어우러진 아이콘카페의 데일리 커피',
    imageUrl: americanoImg,
    imageAlt: '아이스 아메리카노가 담긴 투명 유리잔',
  },
  {
    id: 'cafe-latte',
    name: '카페라떼',
    englishName: 'Cafe Latte',
    category: 'coffee',
    options: ['ICE', 'HOT'],
    priceKrw: null,
    description: '진한 에스프레소에 부드러운 스팀 밀크가 조화롭게 어우러진 라떼',
    imageUrl: cafeLatteImg,
    imageAlt: '라떼 아트가 올려진 따뜻한 카페라떼 세라믹 컵',
  },
  {
    id: 'vanilla-latte',
    name: '바닐라라떼',
    englishName: 'Vanilla Latte',
    category: 'coffee',
    options: ['ICE', 'HOT'],
    priceKrw: null,
    description: '은은한 바닐라 풍미가 커피와 우유에 자연스럽게 녹아든 부드러운 라떼',
    imageUrl: vanillaLatteImg,
    imageAlt: '바닐라 빈이 어우러진 아이스 바닐라라떼',
  },
  {
    id: 'caramel-macchiato',
    name: '카라멜마끼아또',
    englishName: 'Caramel Macchiato',
    category: 'coffee',
    options: ['ICE', 'HOT'],
    priceKrw: null,
    description: '우유 거품 위로 달콤한 카라멜 드리즐을 더한 기분 좋은 달콤함',
    imageUrl: caramelMacchiatoImg,
    imageAlt: '카라멜 드리즐이 올라간 아이스 카라멜마끼아또',
  },
  {
    id: 'matcha-latte',
    name: '말차라떼',
    englishName: 'Matcha Latte',
    category: 'beverage',
    options: ['ICE', 'HOT'],
    priceKrw: null,
    description: '깊고 쌉싸름한 말차의 풍미와 고소한 우유가 만난 진한 그린 라떼',
    imageUrl: matchaLatteImg,
    imageAlt: '진한 녹색 말차와 우유가 층을 이룬 아이스 말차라떼',
  },
  {
    id: 'choco-latte',
    name: '초코라떼',
    englishName: 'Chocolate Latte',
    category: 'beverage',
    options: ['ICE', 'HOT'],
    priceKrw: null,
    description: '묵직하고 진한 코코아의 달콤함을 부드럽게 즐길 수 있는 음료',
    imageUrl: chocoLatteImg,
    imageAlt: '진한 코코아 거품이 올라간 아이스 초코라떼',
  },
  {
    id: 'lemonade',
    name: '레몬에이드',
    englishName: 'Lemonade',
    category: 'beverage',
    options: ['ICE'],
    priceKrw: null,
    description: '상큼한 레몬 과즙과 청량한 탄산이 입안을 산뜻하게 채워주는 에이드',
    imageUrl: lemonadeImg,
    imageAlt: '신선한 레몬 슬라이스가 들어간 스파클링 레몬에이드',
  },
  {
    id: 'peach-iced-tea',
    name: '복숭아아이스티',
    englishName: 'Peach Iced Tea',
    category: 'beverage',
    options: ['ICE'],
    priceKrw: null,
    description: '향긋한 복숭아의 달콤함과 홍차의 깔끔한 뒷맛이 살아있는 아이스티',
    imageUrl: peachIcedTeaImg,
    imageAlt: '복숭아 슬라이스가 올라간 시원한 복숭아아이스티',
  },
];
