"use client"

import Image from "next/image"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

interface PropertyImageGalleryProps {
  images: string[]
  title: string
}

export function PropertyImageGallery({ images, title }: PropertyImageGalleryProps) {
  if (!images || images.length === 0) {
    return (
      <div className="aspect-video w-full rounded-xl bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">No images available</p>
      </div>
    )
  }

  return (
    <div>
      {/* Mobile Carousel */}
      <div className="md:hidden">
        <Carousel className="w-full">
          <CarouselContent>
            {images.map((src, index) => (
              <CarouselItem key={index}>
                <div className="aspect-video relative">
                  <Image src={src} alt={`${title} - Image ${index + 1}`} fill className="object-cover" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4" />
          <CarouselNext className="right-4" />
        </Carousel>
      </div>

      {/* Desktop Grid */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-4">
        <div className="md:col-span-2">
          <div className="aspect-video relative overflow-hidden rounded-xl">
            <Image src={images[0]} alt={`${title} - Main Image`} fill className="object-cover" />
          </div>
        </div>
        {images.slice(1, 3).map((src, index) => (
          <div key={index} className="aspect-video relative overflow-hidden rounded-xl">
            <Image src={src} alt={`${title} - Image ${index + 2}`} fill className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  )
}
