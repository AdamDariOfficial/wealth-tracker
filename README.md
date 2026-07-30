# Wealth Compass

Create a complete full-stack financial tracking web application called “Wealth Tracker”.

The app must be production-ready, scalable, modular, responsive, and designed with a modern minimal futuristic dark theme.

The goal of the platform is to manage:

long-term investments,

ETF accumulation,

crypto portfolio,

trading capital management,

trading journal,

cash/liquidity reserves,

performance analytics,

risk management,

portfolio growth over time.

The app must support future scalability:

adding new assets,

new investment categories,

new brokers,

new accounts,

new metrics,

multi-user support in the future,

API integrations later.

The architecture must be clean, maintainable, and optimized for future expansion.

TECH STACK

Use:

Frontend:

React

Next.js latest App Router

TypeScript

TailwindCSS

Framer Motion

shadcn/ui

Recharts

Backend:

Supabase

Features required:

Authentication

PostgreSQL database

Row level security

Real-time updates

State management:

Zustand

Forms:

React Hook Form

Zod validation

Charts:

Recharts

Deployment ready:

Vercel

DESIGN STYLE

The UI must look:

premium,

futuristic,

minimal,

dark,

smooth,

modern fintech style.

Inspiration:

Bloomberg Terminal minimalism

Apple-level spacing

Modern trading dashboard aesthetic

Glassmorphism

Soft gradients

Neon accents (subtle)

Black/charcoal backgrounds

Main colors:

Background: near-black

Cards: dark gray with glass effect

Accent: electric blue / cyan

Positive values: soft green

Negative values: soft red

Requirements:

smooth animations,

rounded 2xl cards,

hover effects,

animated charts,

responsive layouts,

sidebar navigation,

mobile optimized.

CORE APP STRUCTURE

The app must include:

Dashboard

Investments Module

ETF Tracker

Crypto Portfolio

Trading Capital Manager

Trading Journal

Cash Reserve Manager

Analytics & Performance

Goals & Milestones

Settings

Future-ready Architecture

AUTHENTICATION

Implement:

email/password auth,

persistent sessions,

protected routes,

onboarding flow.

User onboarding must ask:

monthly income,

weekly income,

risk profile,

investment goals,

preferred currency,

broker names,

investment categories.

DATABASE DESIGN

Create scalable normalized database schema.

Tables required:

Users

id

email

created_at

Accounts

id

user_id

name

type

broker

currency

balance

created_at

Assets

id

symbol

name

category

type

notes

Transactions

id

user_id

account_id

asset_id

transaction_type

amount

quantity

price

fees

timestamp

notes

Trading_Journal

id

user_id

asset

setup_type

direction

entry

stop_loss

take_profit

pnl

risk_percent

screenshots

emotions

mistakes

lessons

trade_rating

created_at

Goals

id

user_id

title

target_amount

current_amount

deadline

Cash_Reserves

id

user_id

category

amount

purpose

Performance_Snapshots

id

user_id

portfolio_value

pnl_daily

pnl_weekly

pnl_monthly

created_at

The schema must support:

adding new asset classes,

multiple portfolios,

multiple brokers,

multiple strategies,

future AI analytics.

DASHBOARD

The dashboard must be visually impressive.

Include:

Top stats cards:

Total Net Worth

Total Invested

Trading Capital

Monthly Growth

Weekly Contributions

Portfolio Allocation

Cash Reserve

Profit/Loss

Charts:

Net worth over time

Portfolio allocation pie chart

Weekly investment flow

Trading performance curve

ETF accumulation chart

Crypto growth chart

Widgets:

Weekly investment checklist

Upcoming goals

Recent transactions

Trading metrics

Risk exposure meter

ETF TRACKER MODULE

Features:

recurring investments,

DCA tracking,

allocation percentages,

performance tracking,

dividend tracking,

portfolio distribution.

Allow:

adding ETFs dynamically,

editing allocations,

custom categories,

automatic contribution calculations.

Include:

average buy price,

unrealized PnL,

realized PnL,

growth percentage,

allocation drift.

CRYPTO MODULE

Features:

crypto portfolio tracking,

average cost,

allocation,

portfolio dominance,

transaction history,

performance metrics.

Support:

BTC,

ETH,

altcoins,

custom assets.

Future-ready:

exchange API integrations.

TRADING CAPITAL MANAGER

This module is extremely important.

Create a dedicated area for:

trading account balance,

reserve capital,

risk management,

scaling plans,

drawdown tracking,

capital growth.

Include:

risk calculator,

position size calculator,

max daily loss tracking,

weekly loss limit,

risk-to-reward statistics,

capital phases.

Capital phases:

Build phase

Scaling phase

Professional phase

Show:

progress bars,

milestones,

risk health indicators.

TRADING JOURNAL

Must be advanced and professional.

Features:

add/edit/delete trades,

upload screenshots,

tag setups,

filter trades,

search trades,

emotional tracking,

mistake tracking,

execution score.

Analytics:

win rate,

average RR,

average holding time,

best setup,

worst setup,

session performance,

weekday performance,

strategy performance.

Charts:

equity curve,

cumulative PnL,

win/loss distribution,

RR distribution.

CASH RESERVE MODULE

Track:

emergency funds,

opportunity funds,

dip-buying reserves,

future business capital.

Features:

reserve allocation,

reserve goals,

usage tracking,

reserve growth charts.

GOALS SYSTEM

Create a milestone system.

Examples:

First 1k

First 10k

Trading capital 5k

ETF portfolio 25k

Emergency fund target

Include:

progress tracking,

completion animations,

estimated completion dates.

ANALYTICS PAGE

Must feel institutional-grade.

Include:

portfolio performance,

CAGR,

Sharpe ratio,

risk exposure,

allocation drift,

contribution consistency,

asset correlations,

growth forecasts.

Provide:

monthly reports,

yearly summaries,

portfolio heatmaps.

SETTINGS

Include:

theme customization,

currency settings,

notification preferences,

account management,

export/import data,

backup options.

UX REQUIREMENTS

The app must feel:

fluid,

premium,

fast,

intuitive.

Must include:

loading skeletons,

smooth transitions,

animated counters,

empty states,

beautiful modals,

keyboard shortcuts,

responsive sidebar.

MOBILE EXPERIENCE

Must be fully responsive.

Mobile must:

feel native,

have collapsible navigation,

swipeable cards,

optimized charts,

fast interactions.

FUTURE FEATURES ARCHITECTURE

Prepare architecture for future:

AI insights,

AI portfolio analysis,

broker API sync,

crypto exchange sync,

notifications,

multi-user accounts,

team investing,

advanced tax reports,

automated recurring investments.

Code must be modular and scalable.

FINAL REQUIREMENTS

Generate:

complete folder structure,

reusable component architecture,

clean TypeScript types,

database schema,

Supabase integration,

protected routing,

example seed data,

modern UI components,

production-grade architecture.

The final result must look like a real modern fintech SaaS product, not a basic dashboard.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nebula-wealth-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8adb20eb-ab1d-4518-b794-299f09610365).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
