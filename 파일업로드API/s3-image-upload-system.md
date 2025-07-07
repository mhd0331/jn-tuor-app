# S3 이미지 업로드 시스템 구현

## 1. 필요한 패키지 설치

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install multer multer-s3
npm install sharp
npm install formidable
npm install mime-types
```

## 2. 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가합니다:

```env
# AWS S3 설정
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket-name

# CloudFront CDN 설정
CLOUDFRONT_DOMAIN=https://your-cloudfront-domain.cloudfront.net
```

## 3. S3 클라이언트 설정

`lib/s3.ts`:

```typescript
import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
export const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;
```

## 4. 이미지 리사이징 유틸리티

`lib/image-utils.ts`:

```typescript
import sharp from 'sharp';

export interface ImageSize {
  width: number;
  height?: number;
  suffix: string;
}

export const IMAGE_SIZES: ImageSize[] = [
  { width: 150, suffix: 'thumbnail' },
  { width: 400, suffix: 'small' },
  { width: 800, suffix: 'medium' },
  { width: 1200, suffix: 'large' },
  { width: 1920, suffix: 'xlarge' },
];

export async function resizeImage(
  buffer: Buffer,
  size: ImageSize,
  format: 'jpeg' | 'png' | 'webp' = 'webp'
): Promise<Buffer> {
  const sharpInstance = sharp(buffer);
  
  // 이미지 메타데이터 가져오기
  const metadata = await sharpInstance.metadata();
  
  // 원본 이미지가 목표 크기보다 작으면 리사이징하지 않음
  if (metadata.width && metadata.width <= size.width) {
    return buffer;
  }
  
  return sharpInstance
    .resize(size.width, size.height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFormat(format, {
      quality: format === 'png' ? 90 : 85,
      progressive: true,
      mozjpeg: format === 'jpeg',
    })
    .toBuffer();
}

export async function optimizeImage(
  buffer: Buffer,
  format: 'jpeg' | 'png' | 'webp' = 'webp'
): Promise<Buffer> {
  return sharp(buffer)
    .toFormat(format, {
      quality: 90,
      progressive: true,
      mozjpeg: format === 'jpeg',
    })
    .toBuffer();
}

export function generateImageKey(
  originalName: string,
  size?: string,
  timestamp?: number
): string {
  const ts = timestamp || Date.now();
  const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const nameParts = cleanName.split('.');
  const extension = nameParts.pop();
  const baseName = nameParts.join('.');
  
  if (size) {
    return `images/${ts}-${baseName}-${size}.${extension}`;
  }
  
  return `images/${ts}-${baseName}.${extension}`;
}
```

## 5. S3 업로드 서비스

`lib/s3-upload.ts`:

```typescript
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET_NAME, CLOUDFRONT_DOMAIN } from './s3';
import { IMAGE_SIZES, resizeImage, generateImageKey } from './image-utils';
import mime from 'mime-types';

export interface UploadedImage {
  original: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  xlarge?: string;
  cdnUrls: {
    original: string;
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    xlarge?: string;
  };
}

export async function uploadImageToS3(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadedImage> {
  const timestamp = Date.now();
  const uploadedUrls: UploadedImage = {
    original: '',
    cdnUrls: {
      original: '',
    },
  };

  try {
    // 원본 이미지 업로드
    const originalKey = generateImageKey(originalName, undefined, timestamp);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: originalKey,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000',
      })
    );
    
    uploadedUrls.original = `https://${S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${originalKey}`;
    uploadedUrls.cdnUrls.original = `${CLOUDFRONT_DOMAIN}/${originalKey}`;

    // 이미지 포맷 결정
    const format = mimeType === 'image/png' ? 'png' : 'webp';

    // 다양한 크기로 리사이징 및 업로드
    const uploadPromises = IMAGE_SIZES.map(async (size) => {
      try {
        const resizedBuffer = await resizeImage(buffer, size, format);
        const resizedKey = generateImageKey(
          originalName.replace(/\.[^.]+$/, `.${format}`),
          size.suffix,
          timestamp
        );

        await s3Client.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: resizedKey,
            Body: resizedBuffer,
            ContentType: `image/${format}`,
            CacheControl: 'public, max-age=31536000',
          })
        );

        const s3Url = `https://${S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${resizedKey}`;
        const cdnUrl = `${CLOUDFRONT_DOMAIN}/${resizedKey}`;

        // TypeScript 타입 안전성을 위한 처리
        (uploadedUrls as any)[size.suffix] = s3Url;
        (uploadedUrls.cdnUrls as any)[size.suffix] = cdnUrl;
      } catch (error) {
        console.error(`Failed to upload ${size.suffix} size:`, error);
      }
    });

    await Promise.all(uploadPromises);

    return uploadedUrls;
  } catch (error) {
    console.error('Failed to upload image:', error);
    throw new Error('Image upload failed');
  }
}

export async function deleteImageFromS3(imageUrl: string): Promise<void> {
  try {
    // URL에서 키 추출
    const key = imageUrl.split('.amazonaws.com/')[1];
    
    if (!key) {
      throw new Error('Invalid S3 URL');
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
      })
    );
  } catch (error) {
    console.error('Failed to delete image:', error);
    throw new Error('Image deletion failed');
  }
}

export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}
```

## 6. 업로드 미들웨어

`middleware/upload.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToS3 } from '@/lib/s3-upload';

export interface UploadMiddlewareOptions {
  maxFileSize?: number; // bytes
  allowedMimeTypes?: string[];
}

const DEFAULT_OPTIONS: UploadMiddlewareOptions = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

export function withImageUpload(
  handler: (req: NextRequest, uploadedImages: any[]) => Promise<NextResponse>,
  options: UploadMiddlewareOptions = {}
) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (req: NextRequest) => {
    try {
      const formData = await req.formData();
      const uploadedImages = [];

      for (const [key, value] of formData) {
        if (value instanceof File && key.startsWith('image')) {
          // 파일 크기 검증
          if (value.size > config.maxFileSize!) {
            return NextResponse.json(
              { error: `File size exceeds maximum allowed size of ${config.maxFileSize! / 1024 / 1024}MB` },
              { status: 400 }
            );
          }

          // MIME 타입 검증
          if (!config.allowedMimeTypes!.includes(value.type)) {
            return NextResponse.json(
              { error: `File type ${value.type} is not allowed` },
              { status: 400 }
            );
          }

          // 파일을 버퍼로 변환
          const buffer = Buffer.from(await value.arrayBuffer());

          // S3에 업로드
          const uploadedImage = await uploadImageToS3(
            buffer,
            value.name,
            value.type
          );

          uploadedImages.push({
            fieldName: key,
            originalName: value.name,
            ...uploadedImage,
          });
        }
      }

      // 핸들러 실행
      return handler(req, uploadedImages);
    } catch (error) {
      console.error('Upload middleware error:', error);
      return NextResponse.json(
        { error: 'Failed to process upload' },
        { status: 500 }
      );
    }
  };
}
```

## 7. API 라우트 구현

`app/api/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withImageUpload } from '@/middleware/upload';

export const POST = withImageUpload(
  async (req: NextRequest, uploadedImages: any[]) => {
    // 업로드된 이미지 정보를 데이터베이스에 저장하거나
    // 추가 처리를 수행할 수 있습니다.

    return NextResponse.json({
      success: true,
      images: uploadedImages,
    });
  },
  {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  }
);
```

## 8. 클라이언트 컴포넌트

`components/ImageUpload.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

interface UploadedImageData {
  cdnUrls: {
    original: string;
    thumbnail?: string;
    medium?: string;
  };
}

export default function ImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageData[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();

    Array.from(files).forEach((file, index) => {
      formData.append(`image${index}`, file);
    });

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setUploadedImages((prev) => [...prev, ...data.images]);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          className="hidden"
        />

        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <p className="mt-2 text-sm text-gray-600">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-blue-600 hover:text-blue-500"
            disabled={uploading}
          >
            Click to upload
          </button>
          {' or drag and drop'}
        </p>
        <p className="text-xs text-gray-500">PNG, JPG, WebP up to 5MB</p>

        {uploading && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg">
            <div className="text-blue-600">Uploading...</div>
          </div>
        )}
      </div>

      {uploadedImages.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Uploaded Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {uploadedImages.map((image, index) => (
              <div key={index} className="relative aspect-square">
                <Image
                  src={image.cdnUrls.medium || image.cdnUrls.original}
                  alt={`Uploaded image ${index + 1}`}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

## 9. S3 버킷 정책 설정

S3 버킷에 다음 정책을 적용합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/images/*"
    }
  ]
}
```

## 10. CloudFront 설정

1. **CloudFront 배포 생성**:
   - Origin Domain: S3 버킷
   - Origin Path: /images
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Allowed HTTP Methods: GET, HEAD
   - Cache Policy: Managed-CachingOptimized

2. **캐시 동작 설정**:
   - Path Pattern: /images/*
   - TTL Settings:
     - Minimum TTL: 0
     - Maximum TTL: 31536000
     - Default TTL: 86400

3. **압축 설정**:
   - Compress Objects Automatically: Yes

## 11. 이미지 최적화 컴포넌트

`components/OptimizedImage.tsx`:

```tsx
'use client';

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  sizes?: {
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    xlarge?: string;
  };
  className?: string;
  priority?: boolean;
}

export default function OptimizedImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);

  // 화면 크기에 따라 적절한 이미지 선택
  const getSrcSet = () => {
    if (!sizes) return undefined;

    const srcSet = [];
    if (sizes.small) srcSet.push(`${sizes.small} 400w`);
    if (sizes.medium) srcSet.push(`${sizes.medium} 800w`);
    if (sizes.large) srcSet.push(`${sizes.large} 1200w`);
    if (sizes.xlarge) srcSet.push(`${sizes.xlarge} 1920w`);

    return srcSet.join(', ');
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className={`
          object-cover duration-700 ease-in-out
          ${isLoading ? 'scale-110 blur-2xl grayscale' : 'scale-100 blur-0 grayscale-0'}
        `}
        onLoadingComplete={() => setIsLoading(false)}
        priority={priority}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        {...(getSrcSet() && { srcSet: getSrcSet() })}
      />
    </div>
  );
}
```

## 12. 사용 예제

```tsx
import ImageUpload from '@/components/ImageUpload';
import OptimizedImage from '@/components/OptimizedImage';

export default function GalleryPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Image Gallery</h1>
      
      {/* 이미지 업로드 섹션 */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Upload Images</h2>
        <ImageUpload />
      </section>

      {/* 갤러리 섹션 */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Gallery</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 업로드된 이미지들을 OptimizedImage 컴포넌트로 표시 */}
          <OptimizedImage
            src="https://your-cdn.cloudfront.net/images/123456-example.webp"
            alt="Example image"
            sizes={{
              small: "https://your-cdn.cloudfront.net/images/123456-example-small.webp",
              medium: "https://your-cdn.cloudfront.net/images/123456-example-medium.webp",
              large: "https://your-cdn.cloudfront.net/images/123456-example-large.webp",
            }}
            className="aspect-square"
          />
        </div>
      </section>
    </div>
  );
}
```

## 보안 고려사항

1. **업로드 제한**:
   - 파일 크기 제한
   - MIME 타입 검증
   - 파일 확장자 검증
   - Rate limiting 구현

2. **S3 보안**:
   - IAM 역할 최소 권한 원칙
   - 버킷 정책으로 접근 제한
   - 서명된 URL 사용 고려

3. **이미지 검증**:
   - 악성 코드 스캔
   - 이미지 내용 검증
   - EXIF 데이터 제거

## 성능 최적화

1. **병렬 업로드**: 여러 크기의 이미지를 동시에 업로드
2. **Progressive Enhancement**: 작은 크기부터 순차적 로딩
3. **Lazy Loading**: Intersection Observer 활용
4. **CDN 캐싱**: CloudFront 캐시 정책 최적화
5. **WebP 포맷**: 더 나은 압축률과 품질

이 구현은 확장 가능하고 프로덕션 환경에서 사용할 수 있는 견고한 이미지 업로드 시스템을 제공합니다.