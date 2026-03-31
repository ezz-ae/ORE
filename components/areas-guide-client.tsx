"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, TrendingUp, Home, Users, CheckCircle2 } from "lucide-react"
import type { AreaProfile } from "@/lib/types/project"

interface AreasGuideClientProps {
  areas: AreaProfile[]
}

export function AreasGuideClient({ areas }: AreasGuideClientProps) {
  const [sortBy, setSortBy] = useState<"score" | "price" | "yield">("score")

  const sortedAreas = [...areas].sort((a, b) => {
    if (sortBy === "score") return b.investmentScore - a.investmentScore
    if (sortBy === "price") return a.avgPricePerSqft - b.avgPricePerSqft
    if (sortBy === "yield") return b.rentalYield - a.rentalYield
    return 0
  })

  return (
    <>
      {/* Filters */}
      <section className="border-b border-border bg-card py-6">
        <div className="container">
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm font-medium">Sort by:</div>
            <div className="flex gap-2">
              <Button
                variant={sortBy === "score" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("score")}
                className={sortBy === "score" ? "ore-gradient" : ""}
              >
                Investment Score
              </Button>
              <Button
                variant={sortBy === "price" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("price")}
                className={sortBy === "price" ? "ore-gradient" : ""}
              >
                Price
              </Button>
              <Button
                variant={sortBy === "yield" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("yield")}
                className={sortBy === "yield" ? "ore-gradient" : ""}
              >
                Rental Yield
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Areas Grid */}
      <section className="py-16">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedAreas.map((area) => (
              <Link href={`/areas/${area.slug}`} key={area.slug}>
                <Card className="group overflow-hidden transition-all hover:shadow-lg hover:border-primary/50">
                  <div className="aspect-video relative overflow-hidden bg-muted">
                    <Image src={area.image} alt={area.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                    <div className="absolute top-3 right-3 z-20">
                      {area.freehold && (
                        <Badge className="bg-green-500 text-white border-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Freehold
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-serif text-xl font-bold text-foreground">{area.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{area.description}</p>
                    <div className="space-y-3 pt-4 mt-4 border-t border-border">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Home className="h-4 w-4" />
                          <span>Avg. Price</span>
                        </div>
                        <div className="font-semibold">AED {area.avgPricePerSqft}/sqft</div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <span>Rental Yield</span>
                        </div>
                        <div className="font-semibold text-green-600">{area.rentalYield}%</div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>Properties</span>
                        </div>
                        <div className="font-semibold">{area.propertyCount}+</div>
                      </div>

                      <div className="pt-2 border-t border-border">
                        <div className="flex flex-wrap gap-1.5">
                          {area.lifestyleTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Investment Score</span>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold ore-text-gradient">{area.investmentScore}</div>
                            <div className="text-xs text-muted-foreground">/10</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Info */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="font-serif text-3xl font-bold">Choosing the Right Area</h2>
              <p className="mt-2 text-muted-foreground">Key factors to consider</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <Users className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Lifestyle Match</h3>
                  <p className="text-sm text-muted-foreground">
                    Consider your lifestyle preferences: beach living, family-friendly communities, urban excitement, or peaceful suburbs.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <TrendingUp className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Investment Potential</h3>
                  <p className="text-sm text-muted-foreground">
                    Evaluate rental yields, capital appreciation trends, and future development plans in the area.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <MapPin className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Connectivity</h3>
                  <p className="text-sm text-muted-foreground">
                    Check proximity to metro stations, major highways, airports, and key business districts.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <Home className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Amenities</h3>
                  <p className="text-sm text-muted-foreground">
                    Look for schools, hospitals, shopping malls, restaurants, and recreational facilities nearby.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container">
          <Card className="ore-gradient">
            <CardContent className="p-8 md:p-12 text-center">
              <h2 className="font-serif text-3xl font-bold text-primary-foreground">
                Need Help Choosing an Area?
              </h2>
              <p className="mt-4 text-primary-foreground/90 max-w-2xl mx-auto">
                Our local experts can provide personalized recommendations based on your investment goals and lifestyle preferences.
              </p>
              <div className="flex flex-wrap gap-4 justify-center mt-8">
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/contact">Speak with Expert</Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" asChild>
                  <Link href="/properties">Browse All Properties</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  )
}
