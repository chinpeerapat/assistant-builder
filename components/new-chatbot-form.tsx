'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { eventGA } from "@/lib/googleAnalytics"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Form, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"
import { chatbotSchema } from "@/lib/validations/chatbot"
import { ChatbotModel, File, User } from "@prisma/client"
import Select from 'react-select'
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"

type FormData = z.infer<typeof chatbotSchema>

interface NewChatbotProps extends React.HTMLAttributes<HTMLElement> {
    isOnboarding: boolean
    user: Pick<User, "id">
}

export function NewChatbotForm({ isOnboarding, className, ...props }: NewChatbotProps) {
    const router = useRouter()
    const [storedOpenAIKey, setStoredOpenAIKey] = useState<string | null>(null)
    const [models, setModels] = useState<ChatbotModel[]>([])
    const [availablesModels, setAvailablesModels] = useState<string[]>([])
    const [files, setFiles] = useState<File[]>([])
    const [isSaving, setIsSaving] = useState<boolean>(false)
    const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true)

    const form = useForm<FormData>({
        resolver: zodResolver(chatbotSchema),
        defaultValues: {
            welcomeMessage: "Hello, how can I help you?",
            prompt: "You are an assistant you help users that visit our website, keep it short, always refer to the documentation provided and never ask for more information.",
            chatbotErrorMessage: "Oops! An error has occurred. If the issue persists, feel free to reach out to our support team for assistance. We're here to help!"
        }
    })

    useEffect(() => {
        const init = async () => {
            try {
                setIsLoadingModels(true)
                const [modelsResponse, supportedModels, filesResponse, storedKey] = await Promise.all([
                    fetch('/api/models'),
                    getAvailableModels(),
                    getFiles(),
                    getStoredOpenAIKey()
                ])

                if (!modelsResponse.ok) throw new Error('Failed to fetch models')
                const models = await modelsResponse.json()
                setModels(models)
                setAvailablesModels(supportedModels)
                setFiles(filesResponse)
                setStoredOpenAIKey(storedKey)

                if (storedKey) {
                    form.setValue('openAIKey', storedKey)
                }
            } catch (error) {
                console.error('Error initializing form:', error)
                toast({
                    title: "Error",
                    description: "Failed to load necessary data. Please try again.",
                    variant: "destructive"
                })
            } finally {
                setIsLoadingModels(false)
            }
        }
        init()
    }, [form])

    async function getFiles() {
        const response = await fetch('/api/files', {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
        if (!response.ok) throw new Error('Failed to fetch files')
        return response.json()
    }

    async function getAvailableModels() {
        const response = await fetch(`/api/users/${props.user.id}/openai/models`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
        if (!response.ok) throw new Error('Failed to fetch available models')
        return response.json()
    }

    async function getStoredOpenAIKey() {
        const response = await fetch(`/api/users/${props.user.id}/openai`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
        if (!response.ok) return null
        const data = await response.json()
        return data.openAIKey
    }

    async function onSubmit(data: FormData) {
        setIsSaving(true)
        try {
            const response = await fetch(`/api/chatbots`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: data.name,
                    prompt: data.prompt,
                    openAIKey: data.openAIKey,
                    welcomeMessage: data.welcomeMessage,
                    chatbotErrorMessage: data.chatbotErrorMessage,
                    modelId: data.modelId,
                    files: data.files
                }),
            })

            if (!response.ok) {
                if (response.status === 400) {
                    throw new Error(await response.text())
                } else if (response.status === 402) {
                    throw new Error("Chatbot limit reached. Please upgrade to a higher plan.")
                }
                throw new Error("Your chatbot was not saved. Please try again.")
            }

            toast({
                description: "Your chatbot has been saved.",
            })

            eventGA({
                action: 'chatbot_created',
                label: 'Chatbot Created',
                value: data.name
            })

            router.refresh()

            if (!isOnboarding) {
                const object = await response.json()
                router.push(`/dashboard/chatbots/${object.chatbot.id}/chat`)
            }
        } catch (error) {
            console.error('Error saving chatbot:', error)
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "An unexpected error occurred",
                variant: "destructive"
            })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Create new Chatbot</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="name">
                                        Display Name
                                    </FormLabel>
                                    <Input
                                        {...field}
                                        id="name"
                                    />
                                    <FormDescription>
                                        The name that will be displayed in the dashboard
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="welcomeMessage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="welcomemessage">
                                        Welcome message
                                    </FormLabel>
                                    <Input
                                        {...field}
                                        id="welcomemessage"
                                    />
                                    <FormDescription>
                                        The welcome message that will be sent to the user when they start a conversation
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>)}
                        />
                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="prompt">
                                        Default prompt
                                    </FormLabel >
                                    <Textarea
                                        {...field}
                                        id="prompt"
                                    />
                                    <FormDescription>
                                        The prompt that will be sent to OpenAI for every messages, here&apos;s and example:
                                        &quot;You are an assistant you help users that visit our website, keep it short, always refer to the documentation provided and never ask for more information.&quot;
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="files"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="files">
                                        Choose your file for retrieval
                                    </FormLabel>
                                    <Select
                                        isMulti
                                        closeMenuOnSelect={false}
                                        onChange={value => field.onChange(value.map((v: any) => v.value))}
                                        defaultValue={field.value}
                                        name="files"
                                        id="files"
                                        options={files.map((file) => ({ value: file.id, label: file.name }))}
                                        className="basic-multi-select"
                                        classNamePrefix="select"
                                    />
                                    <FormDescription>
                                        The OpenAI model will use this file to search for specific content.
                                        If you don&apos;t have a file yet, it is because you haven&apos;t published any file.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="modelId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="modelId">
                                        OpenAI Model
                                    </FormLabel>
                                    <Select
                                        onChange={value => field.onChange(value!.value)}
                                        defaultValue={field.value}
                                        id="modelId"
                                        options={
                                            models.filter((model: ChatbotModel) => availablesModels.includes(model.name)).map((model: ChatbotModel) => (
                                                { value: model.id, label: model.name }
                                            ))
                                        }
                                        className="basic-multi-select"
                                        classNamePrefix="select"
                                        isLoading={isLoadingModels}
                                    />
                                    <FormDescription>
                                        The OpenAI model that will be used to generate responses.
                                        <b> If you don&apos;t have the gpt-4 option and want to use it. You need to have an OpenAI account at least tier 1.</b>
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="openAIKey"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="openAIKey">
                                        OpenAI API Key
                                    </FormLabel>
                                    <Input
                                        {...field}
                                        id="openAIKey"
                                        type="password"
                                        placeholder={storedOpenAIKey ? "Using stored API key" : "Enter your OpenAI API key"}
                                    />
                                    <FormDescription>
                                        The OpenAI API key that will be used to generate responses.
                                        You can create your API Key <Link target="_blank" className="underline" href='https://platform.openai.com/api-keys'>here</Link>.
                                        {storedOpenAIKey && " A stored API key is available. Leave this field empty to use the stored key."}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="chatbotErrorMessage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="chatbotErrorMessage">
                                        Chatbot Error Message
                                    </FormLabel>
                                    <Textarea
                                        {...field}
                                        id="chatbotErrorMessage"
                                    />
                                    <FormDescription>
                                        The message that will be displayed when the chatbot encounters an error and can&apos;t reply to a user.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <button
                            type="submit"
                            className={cn(buttonVariants(), className)}
                            disabled={isSaving || isLoadingModels}
                        >
                            {isSaving && (
                                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            <span>{isSaving ? "Creating..." : "Create"}</span>
                        </button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    )
}
