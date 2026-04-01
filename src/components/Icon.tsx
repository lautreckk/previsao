"use client";
import {
  House, ChatCircleDots, Ticket, User, MagnifyingGlass, PaperPlaneTilt,
  SmileySticker, Lightning, Fire, TrendUp, CurrencyBtc, Bank,
  SoccerBall, Sun, Globe, FilmSlate, ChatTeardropDots, SquaresFour,
  Clock, CheckCircle, ChartBar, CaretDown, CaretUp, X, Plus, Minus,
  ArrowUp, ArrowDown, Eye, EyeSlash, Copy, Trash, Key, Shield,
  Gear, UsersThree, MonitorPlay, Handshake, ChartLine, Wallet,
  SignOut, Star, Trophy, Target, Coins, Drop, CloudSun, Thermometer,
  GameController, Heart, Bell, Warning, Info, MapPin, Calendar,
  CreditCard, QrCode, Receipt, ArrowLeft, CaretRight, DotsThreeOutline,
  Funnel, SortAscending, Camera, ChartLineUp, ArrowDown as ArrowDownIcon
} from "@phosphor-icons/react";
import type { CSSProperties, ElementType } from "react";

interface IconProps {
  name: string;
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  className?: string;
  style?: CSSProperties;
}

const ICON_MAP: Record<string, ElementType> = {
  // Navigation
  "home": House,
  "dashboard": SquaresFour,
  "forum": ChatCircleDots,
  "chat": ChatTeardropDots,
  "person": User,
  "group": UsersThree,
  "search": MagnifyingGlass,
  "send": PaperPlaneTilt,
  "mood": SmileySticker,

  // Categories
  "currency_bitcoin": CurrencyBtc,
  "account_balance": Bank,
  "sports_soccer": SoccerBall,
  "wb_sunny": Sun,
  "public": Globe,
  "movie": FilmSlate,
  "trending_up": TrendUp,
  "category": Target,
  "monitoring": ChartLineUp,

  // Actions
  "bolt": Lightning,
  "local_fire_department": Fire,
  "schedule": Clock,
  "check_circle": CheckCircle,
  "bar_chart": ChartBar,
  "expand_more": CaretDown,
  "expand_less": CaretUp,
  "close": X,
  "add": Plus,
  "remove": Minus,
  "arrow_upward": ArrowUp,
  "arrow_downward": ArrowDown,
  "visibility": Eye,
  "visibility_off": EyeSlash,
  "content_copy": Copy,
  "delete": Trash,
  "vpn_key": Key,
  "key": Key,
  "shield": Shield,
  "settings": Gear,
  "monitor_heart": MonitorPlay,
  "handshake": Handshake,
  "storefront": ChartLine,
  "pix": QrCode,
  "account_balance_wallet": Wallet,
  "logout": SignOut,
  "star": Star,
  "emoji_events": Trophy,
  "confirmation_number": Ticket,
  "arrow_back": ArrowLeft,
  "chevron_right": CaretRight,
  "more_horiz": DotsThreeOutline,
  "filter_list": Funnel,
  "sort": SortAscending,
  "info": Info,
  "warning": Warning,
  "notifications": Bell,
  "favorite": Heart,
  "location_on": MapPin,
  "calendar_today": Calendar,
  "credit_card": CreditCard,
  "receipt": Receipt,
  "search_off": MagnifyingGlass,
  "touch_app": Target,
  "hourglass_empty": Clock,
  "error": Warning,
  "key_off": Key,
  "add_circle": Plus,
  "cancel": X,
  "progress_activity": Clock,
  "keyboard_arrow_down": ArrowDown,
  "photo_camera": Camera,
};

export default function Icon({ name, size = 20, weight = "regular", className = "", style }: IconProps) {
  const Component = ICON_MAP[name];
  if (!Component) {
    // Fallback: still render material icon for unmapped ones
    return <span className={`material-symbols-outlined ${className}`} style={{ fontSize: size, ...style }}>{name}</span>;
  }
  return <Component size={size} weight={weight} className={className} style={style} />;
}

// Named export for category icons with duotone weight
export function CategoryIcon({ name, size = 16, className = "", style }: Omit<IconProps, "weight">) {
  const Component = ICON_MAP[name];
  if (!Component) {
    return <span className={`material-symbols-outlined ${className}`} style={{ fontSize: size, ...style }}>{name}</span>;
  }
  return <Component size={size} weight="duotone" className={className} style={style} />;
}
