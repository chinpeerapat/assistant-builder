"use client"

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Chatbot } from "@prisma/client"
import { Icons } from "./icons"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { cn } from "../lib/utils"

import { CardHeader } from "./ui/card"
import { useChat } from 'ai/react'
import { Message } from 'ai/react'
import { useEffect, useRef, useState } from "react"
import { toast } from "../components/ui/use-toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { FooterText } from "./chat-footer-text"
import { ChatMessage } from "./chat-message"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { useEnterSubmit } from '../hooks/use-enter-submit'

interface ChatbotProps {
  chatbot: Chatbot
  defaultMessage: string
  className?: string
  withExitX?: boolean
  clientSidePrompt?: string
}

export function Chat({ chatbot, defaultMessage, className, withExitX = false, clientSidePrompt, ...props }: ChatbotProps) {
  const [open, setOpen] = useState(false);

  // inquiry
  const [hideInquiry, setHideInquiry] = useState(false)
  const [sendInquiry, setSendInquiry] = useState(false);
  const [userEmail, setUserEmail] = useState('')
  const [userMessage, setUserMessage] = useState('')
  const [inquiryLoading, setInquiryLoading] = useState(false)

  const inputFileRef = useRef<HTMLInputElement>(null);

  const [chatThreadId, setChatThreadId] = useState<string | null>(null)

  const { formRef, onKeyDown } = useEnterSubmit()

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({ api: `/api/chatbots/${chatbot.id}/chat` });

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`/api/chatbots/${chatbot.id}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('File upload failed');
      }
      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive'
      });
    }
  };

  function handleSubmitMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    handleSubmit(e)
    setFileUploaded(false)
    if (inputFileRef.current) {
      inputFileRef.current.value = '';
    }
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [fileUploaded, setFileUploaded] = useState(false);

  useEffect(() => {
    if (error) {
      console.log(error)
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }, [error])

  useEffect(() => {
    // Scroll to the bottom of the container on messages update
    const endElement = document.getElementById("end");
    if (endElement) {
      endElement.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function handleInquirySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setInquiryLoading(true)

    const response = await fetch(`/api/chatbots/${chatbot.id}/inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatbotId: chatbot.id,
        threadId: chatThreadId || '',
        email: userEmail,
        inquiry: userMessage,
      }),
    })

    if (response.ok) {
      setSendInquiry(false)
      messages.push({
        id: String(messages.length + 1),
        role: 'assistant',
        content: chatbot.inquiryAutomaticReplyText,
      })
    } else {
      console.error(`Failed to send inquiry: ${response}`)
      toast({
        title: 'Error',
        description: 'Failed to send inquiry',
        variant: 'destructive'
      })
    }
    // close dialog
    setOpen(false)
    setInquiryLoading(false)
  }

  useEffect(() => {
    if (defaultMessage !== '') {
      handleInputChange({ target: { value: defaultMessage } } as React.ChangeEvent<HTMLInputElement>);
    }
  }, [defaultMessage, handleInputChange])

  function closeChat() {
    window.parent.postMessage('closeChat', '*')
  }

  return (
    <>
      <CardHeader style={{ background: chatbot.chatHeaderBackgroundColor }} className="sticky z-50 top-0 border-b p-4">
        <div className="flex flex-row justify-between items-center">
          <h2 className="text-xl font-bold flex items-center h-10 gap-2">
            <div style={{ color: chatbot.chatHeaderTextColor }}>
              {chatbot.chatTitle}
            </div>
          </h2>
          <div className="flex flex-row items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={'nothing'}
                  className="cursor-pointer"
                  size={'icon'}
                  onClick={() => {
                    window.location.reload()
                  }}
                >
                  <Icons.reload style={{ color: chatbot.chatHeaderTextColor }} className="h-4 w-4" />
                  <span className="sr-only">New Chat</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Chat</TooltipContent>
            </Tooltip>
            {withExitX &&
              <div className="items-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={closeChat} variant="nothing" className="cursor-pointer">
                      <Icons.close style={{ color: chatbot.chatHeaderTextColor }} className="h-5 w-5 text-gray-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exit Chat</TooltipContent>
                </Tooltip>
              </div>
            }
          </div>
        </div>
      </CardHeader>
      <div
        className="group w-full overflow-auto pl-0 peer-[[data-state=open]]:lg:pl-[250px] peer-[[data-state=open]]:xl:pl-[300px]"
      >
        <div
          className={cn('pb-[200px] overflow-auto pl-5 sm:pl-20 pr-5 sm:pr-20 md:pb-[200px] pt-4 md:pt-10', className)}
        >
          <ChatMessage isFirst={true} chatbot={chatbot} message={{ id: '0', role: "assistant", content: chatbot.welcomeMessage }} />
          <div className="flex-grow overflow-y-auto space-y-6 flex flex-col order-2">
            {messages.map((message: Message, index) => {
              return (
                <ChatMessage chatbot={chatbot} key={index} message={message} />
              );
            })}
          </div>
          {isLoading &&
            <div className="mt-4">
              <ChatMessage chatbot={chatbot} message={{ id: 'waiting', role: "assistant", content: 'loading' }} />
            </div>
          }
          <div id="end" ref={containerRef}> </div>
        </div>
        <div className="fixed inset-x-0 bottom-0 w-full ease-in-out animate-in peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px]">
          <div className={`mx-auto ${chatbot.chatInputStyle === 'default' ? 'sm:max-w-2xl sm:px-4' : ''}`}>
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2 px-4 ">
              {chatbot.inquiryEnabled && !hideInquiry && messages.length >= chatbot.inquiryDisplayLinkAfterXMessage &&
                <div className="relative">
                  <button onClick={() => { setHideInquiry(true) }} className="bg-zinc-100 shadow hover:bg-zinc-200 border rounded absolute top-0 right-0 -mt-1 -mr-1">
                    <Icons.close className="h-4 w-4" />
                  </button>
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-white" variant="outline">
                        {chatbot.inquiryLinkText}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <form onSubmit={handleInquirySubmit}>
                        <DialogHeader>
                          <DialogTitle>{chatbot.inquiryTitle}</DialogTitle>
                          <DialogDescription>
                            {chatbot.inquirySubtitle}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4 w-full">
                          <div className="gap-4">
                            <Label htmlFor="name" className="text-right">
                              {chatbot.inquiryEmailLabel}
                            </Label>
                            <Input onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserEmail(e.target.value)} className="bg-white" id="email" pattern=".+@.+\..+" type="email" />
                          </div>
                          <div className="gap-4">
                            <Label htmlFor="username" className="text-right">
                              {chatbot.inquiryMessageLabel}
                            </Label>
                            <Textarea onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUserMessage(e.target.value)} className="min-h-[100px]" id="message" />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={inquiryLoading}>
                            {chatbot.inquirySendButtonText}
                            {inquiryLoading && (
                              <Icons.spinner className="ml-2 mr-2 h-5 w-5 animate-spin" />
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              }
            </div>
            <div className="space-y-4 border-t bg-background px-4 py-2 shadow-lg sm:rounded-t-xl md:py-4">
              <form onSubmit={handleSubmitMessage}
                {...props}
                ref={formRef}
              >
                {
                  fileUploaded && inputFileRef.current?.files?.[0] &&
                  <div className="flex w-full sm:w-1/2 items-center p-2 bg-white border rounded-lg shadow-sm">
                    <Icons.document className="text-gray-400 w-6 h-6 flex-shrink-0" />
                    <div className="flex flex-col pl-3 pr-6 flex-1 min-w-0">
                      <span className="font-sm text-gray-800 truncate">{inputFileRef.current.files[0].name}</span>
                      <span className="text-sm text-gray-500">Document</span>
                    </div>
                    <Button type="button" variant="ghost" className="flex-shrink-0" onClick={() => {
                      if (inputFileRef.current) {
                        inputFileRef.current.value = '';
                      }
                      setFileUploaded(false);
                    }}>
                      <Icons.close className="text-gray-400 w-4 h-4" />
                    </Button>
                  </div>
                }
                <div className={`relative flex max-h-60 w-full grow flex-col overflow-hidden bg-background ${chatbot.chatFileAttachementEnabled ? 'px-8 sm:px-12' : 'px-2 sm:px-2'}`}>
                  {chatbot.chatFileAttachementEnabled &&
                    <div className="">
                      <Label htmlFor="file" className="">
                        <div
                          className={`size-9 absolute left-0 top-[12px] size-8 rounded-full bg-background p-0 sm:left-4 border border-input hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background`}
                        >
                          <Icons.paperclip className="text-muted-foreground h-4 w-4" />
                        </div>
                      </Label>
                      <Input
                        ref={inputFileRef}
                        id="file"
                        type="file"
                        className="hidden"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file);
                            setFileUploaded(true);
                          }
                        }}
                      />
                    </div>
                  }
                  <div className={chatbot.chatFileAttachementEnabled ? `pl-4` : `` + ` pr-8`}>
                    <Textarea
                      ref={inputRef}
                      tabIndex={0}
                      onKeyDown={onKeyDown}
                      placeholder={chatbot.chatMessagePlaceHolder}
                      className="border-0 border-gray-300 rounded-lg min-h-[60px] w-full resize-none bg-white pl-4 py-[1rem] sm:text-sm shadow-sm focus-visible:ring-0"
                      spellCheck={false}
                      autoComplete="off"
                      autoCorrect="off"
                      name="message"
                      rows={1}
                      value={input}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className={`absolute top-[14px] right-0`}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          id="submit"
                          disabled={isLoading || input === ''}
                          type="submit" size="icon">
                          <Icons.arrowRight />
                          <span className="sr-only">Send message</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Send message</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                {
                  chatbot.displayBranding &&
                  <FooterText className="block my-2" />
                }
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
