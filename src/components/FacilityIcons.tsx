import React from 'react';
import metalImg from '../assets/facilities/metal.png';
import woodImg from '../assets/facilities/wood.png';
import leatherImg from '../assets/facilities/leather.png';
import clothImg from '../assets/facilities/cloth.png';
import medicineImg from '../assets/facilities/medicine.png';
import foodImg from '../assets/facilities/food.png';

export interface IconProps {
  size?: number;
  color?: string; // 하위 호환성을 위해 유지
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

interface ImageFacilityIconProps extends IconProps {
  src: string;
  defaultAlt: string;
}

const FacilityImage: React.FC<ImageFacilityIconProps> = ({
  src,
  defaultAlt,
  size = 16,
  className,
  style,
  alt,
}) => (
  <img
    src={src}
    alt={alt || defaultAlt}
    width={size}
    height={size}
    className={className}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      objectFit: 'contain',
      display: 'inline-block',
      verticalAlign: 'middle',
      userSelect: 'none',
      filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))',
      ...style,
    }}
    draggable={false}
  />
);

/** 1. 금속: 고해상도 금속 주괴 */
export const MetalIngotIcon: React.FC<IconProps> = (props) => (
  <FacilityImage src={metalImg} defaultAlt="금속" {...props} />
);

/** 2. 목재: 고해상도 통나무 / 가공 목재 */
export const WoodPlankIcon: React.FC<IconProps> = (props) => (
  <FacilityImage src={woodImg} defaultAlt="목재" {...props} />
);

/** 3. 가죽: 고해상도 가죽 원단 */
export const LeatherRollIcon: React.FC<IconProps> = (props) => (
  <FacilityImage src={leatherImg} defaultAlt="가죽" {...props} />
);

/** 4. 옷감: 고해상도 접힌 천 / 원단 */
export const FoldedClothIcon: React.FC<IconProps> = (props) => (
  <FacilityImage src={clothImg} defaultAlt="옷감" {...props} />
);

/** 5. 약품: 고해상도 시약병 / 앰플 */
export const MedicineVialIcon: React.FC<IconProps> = (props) => (
  <FacilityImage src={medicineImg} defaultAlt="약품" {...props} />
);

/** 6. 식료품: 고해상도 치즈 조각 / 식품 */
export const CheeseIcon: React.FC<IconProps> = (props) => (
  <FacilityImage src={foodImg} defaultAlt="식품" {...props} />
);

export const FACILITY_IMAGE_MAP = {
  metal: metalImg,
  wood: woodImg,
  leather: leatherImg,
  cloth: clothImg,
  medicine: medicineImg,
  food: foodImg,
} as const;
