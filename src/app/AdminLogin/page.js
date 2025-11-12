'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const validateForm = () => {
    const errors = {}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email.trim()) {
      errors.email = "Email is required."
    } else if (!emailRegex.test(email)) {
      errors.email = "Please enter a valid email address."
    }

    if (!password.trim()) {
      errors.password = "Password is required."
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters long."
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        // Login successful, redirect to dashboard
        router.push('/Dashboard')
      } else {
        // Handle error
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="authentication-wrapper authentication-cover">
        <Link href="/" className="auth-cover-brand d-flex align-items-center gap-2">
          <img src='/images/logo.png' style={{width:"30%"}}/>
        </Link>

        <div className="authentication-inner row m-0">
          <div className="d-none d-lg-flex col-lg-7 col-xl-8 align-items-center justify-content-center p-12 pb-2">
            <img
              src="/assets/img/illustrations/auth-login-illustration-light.png"
              className="auth-cover-illustration w-100"
              alt="auth-illustration"
              data-app-light-img="illustrations/auth-login-illustration-light.png"
              data-app-dark-img="illustrations/auth-login-illustration-dark.png" />
            <img
              src="/assets/img/illustrations/auth-cover-login-mask-light.png"
              className="authentication-image"
              alt="mask"
              data-app-light-img="illustrations/auth-cover-login-mask-light.png"
              data-app-dark-img="illustrations/auth-cover-login-mask-dark.png" />
          </div>

          <div className="d-flex col-12 col-lg-5 col-xl-4 align-items-center authentication-bg position-relative py-sm-12 px-12 py-6">
            <div className="w-px-400 mx-auto pt-5 pt-lg-0">
              <h4 className="mb-1">Welcome to Requrr! 👋</h4>
              <p className="mb-5">Take control of your finances—track your income now</p>

              <form id="formAuthentication" className="mb-5" onSubmit={handleLogin}>
                <div className="form-floating form-floating-outline mb-5">
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    required
                  />
                  <label htmlFor="email">Email</label>
                  {fieldErrors.email && <div className="text-danger small">{fieldErrors.email}</div>}
                </div>

                <div className="mb-5">
                  <div className="form-password-toggle">
                    <div className="input-group input-group-merge">
                      <div className="form-floating form-floating-outline">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="password"
                          className="form-control"
                          name="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••"
                          aria-describedby="password"
                          required
                        />
                        <label htmlFor="password">Password</label>
                      </div>
                      <span
                        className="input-group-text cursor-pointer"
                        onClick={() => setShowPassword((prev) => !prev)}
                        role="button"
                        aria-label="Toggle password visibility"
                      >
                        <i className={`ri-${showPassword ? 'eye-line' : 'eye-off-line'}`}></i>
                      </span>
                    </div>
                    {fieldErrors.password && <div className="text-danger small">{fieldErrors.password}</div>}
                  </div>
                </div>

                <div className="mb-5 d-flex justify-content-between mt-5">
                  <Link href="/Forgot" className="float-end mb-1 mt-2">
                    <span>Forgot Password?</span>
                  </Link>
                </div>

                {error && <p className="text-danger">{error}</p>}

                <button className="btn btn-primary d-grid w-100" type="submit" disabled={loading}>
                  {loading ? "Logging in..." : "Sign in"}
                </button>
              </form>

              <p className="text-center">
                <span>New on our platform?</span>
                <Link href="/SignUp">
                  <span> Create an account</span>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
