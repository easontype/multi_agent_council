'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { getTranslations, type UiMessages, type SupportedLocale } from './translations'

const UiLocaleContext = createContext<UiMessages>(getTranslations('en'))

export function UiLocaleProvider({
  locale,
  children,
}: {
  locale: SupportedLocale | string
  children: ReactNode
}) {
  return (
    <UiLocaleContext.Provider value={getTranslations(locale)}>
      {children}
    </UiLocaleContext.Provider>
  )
}

export function useUiLocale(): UiMessages {
  return useContext(UiLocaleContext)
}
