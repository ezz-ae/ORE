"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Phone, User, Mail, MessageCircle } from "lucide-react"

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  phone: z.string().min(8, "Please enter a valid phone number."),
  message: z.string().optional(),
})

interface ProjectLeadFormProps {
  projectName: string
  projectSlug: string
}

export function ProjectLeadForm({ projectName, projectSlug }: ProjectLeadFormProps) {
  const { toast } = useToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: `I'm interested in ${projectName}. Please send me more details.`,
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          interest: "project-enquiry",
          source: `project:${projectSlug}`,
          projectSlug,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send enquiry.")
      }

      toast({
        title: "Enquiry Sent",
        description: "Your request is in our CRM. A property consultant will contact you shortly.",
      })

      form.reset({
        name: "",
        email: "",
        phone: "",
        message: `I'm interested in ${projectName}. Please send me more details.`,
      })
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Unable to send enquiry.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-lg">
      <div className="p-6">
        <h3 className="font-serif text-xl font-bold">Request Details</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Get floor plans, payment plans, and availability for this project.
        </p>
      </div>
      
      <div className="border-t border-border p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Full Name" {...field} className="pl-9" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" placeholder="Email Address" {...field} className="pl-9" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Phone</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="tel" placeholder="Phone Number" {...field} className="pl-9" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Message</FormLabel>
                  <FormControl>
                    <div className="relative">
                       <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea placeholder="Your Message" {...field} className="pl-9" rows={3} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full ore-gradient text-black font-semibold" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Sending..." : "Send Enquiry"}
            </Button>
          </form>
        </Form>
      </div>

      <div className="border-t border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">Or speak to a consultant directly</p>
        <Button variant="outline" className="mt-4 w-full" asChild>
          <a href="https://wa.me/97150000000" target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp Us
          </a>
        </Button>
      </div>
    </div>
  )
}
