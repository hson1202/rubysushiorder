import { useEffect } from 'react'

const ExternalRedirect = ({ to }) => {
  useEffect(() => {
    window.location.replace(to)
  }, [to])

  return null
}

export default ExternalRedirect
