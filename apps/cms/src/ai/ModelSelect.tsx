'use client'

import type { TextFieldClientComponent } from 'payload'

import { FieldLabel, SelectInput, useConfig, useField } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import type { ModelsResponse } from './models'

import { MODELS_ENDPOINT_PATH } from './models'

/**
 * Replaces the plugin's hard-coded "Model" select in each field's Compose
 * Settings with the list the gateway actually serves. Stored as plain text, so
 * a model that disappears from the gateway stays readable — it is simply added
 * back to the options until someone picks another one.
 */
export const ModelSelect: TextFieldClientComponent = ({ field, path, readOnly }) => {
  const { value, setValue } = useField<string>({ path })
  const { config } = useConfig()
  const [response, setResponse] = useState<ModelsResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${config.serverURL}${config.routes.api}${MODELS_ENDPOINT_PATH}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<ModelsResponse>) : Promise.reject(res.status)))
      .then((data) => {
        setResponse(data)
        setFailed(false)
      })
      .catch((error: unknown) => {
        // The cleanup below aborts the request when the effect re-runs (React
        // does that once in development): not a failure.
        if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true)
      })
    return () => controller.abort()
  }, [config.serverURL, config.routes.api])

  const options = (response?.models ?? []).map(({ id, provider }) => ({
    label: provider ? `${id} (${provider})` : id,
    value: id,
  }))
  if (value && !options.some((option) => option.value === value)) {
    options.unshift({ label: `${value} (not listed by the gateway)`, value })
  }

  const description = failed
    ? 'Could not load the model list.'
    : response?.source === 'fallback'
      ? `Gateway unreachable (${response.error}) — showing AMAZEE_AI_MODELS.`
      : response
        ? `${response.models.length} chat models available to this key.`
        : 'Loading models…'

  return (
    <div className="field-type select">
      <FieldLabel label={field.label ?? 'Model'} path={path} required={field.required} />
      <SelectInput
        name={path}
        path={path}
        description={description}
        options={options}
        readOnly={readOnly}
        value={value ?? ''}
        onChange={(selected) => {
          const option = Array.isArray(selected) ? selected[0] : selected
          setValue(option && typeof option === 'object' && 'value' in option ? option.value : null)
        }}
      />
    </div>
  )
}
