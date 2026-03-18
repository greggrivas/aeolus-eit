# INTERFACE

## Purpose

This document defines the interface structure for Aeolus.

The interface is now scoped to a **single-farm Wind Farm A prototype**.

It translates the project plan into a frontend shape that can be:

- prototyped
- implemented in Next.js
- wired to the FastAPI backend
- refined for the course presentation

## Product Framing

Aeolus is not being presented as a multi-farm platform in the current course scope.

The interface should present:

- Wind Farm A event analysis
- Wind Farm A benchmark runs
- a clear event-centric workflow

Any multi-farm extension belongs only in future work and should not shape the current UI.

## Design Principles

### 1. Event-first

The interface should center on:

- events
- event timelines
- event metadata
- model outputs
- benchmark runs

### 2. Single-farm clarity

The user should never be confused about scope.

The UI should clearly communicate that:

- the current project is about Wind Farm A

### 3. Assistant is supporting, not central

The assistant panel should be present, but secondary.

### 4. Technical and readable

The UI should feel:

- analytical
- structured
- clear
- presentation-friendly

## Top-Level App Structure

The main shell should have:

1. header
2. left sidebar
3. main workspace
4. optional right assistant panel

## Header

The header should include:

- app name: `Aeolus`
- subtitle: `Wind Farm A Fault Detection Workspace`
- current mode switch
- benchmark status indicator
- assistant toggle

### Header behavior

The mode switch should allow:

- `Operations`
- `Benchmark Lab`
- `Dataset Explorer`

## Left Sidebar

The sidebar should provide:

- global navigation
- Wind Farm A event list
- optionally recent benchmark runs

### Sections

#### Global navigation

- Overview
- Operations
- Benchmark Lab
- Dataset Explorer

#### Event list

The sidebar should show:

- Wind Farm A events
- anomaly/normal badge
- compact event description

There is no farm-switching section in the current scope.

## Assistant Panel

The assistant panel should be:

- collapsible
- non-blocking
- clearly optional

### States

- disabled
- ready later
- loading
- error

## Core Screens

## 1. Overview

### Purpose

Give a quick summary of the Wind Farm A prototype.

### Main content

- Wind Farm A event totals
- anomaly vs normal count
- latest benchmark run
- quick jump to selected event

## 2. Operations Screen

### Purpose

Provide the main analyst-facing event review workspace for Wind Farm A.

### Layout

- left sidebar with event list
- center event workspace
- optional assistant panel

### Main sections

#### Event header

Show:

- event ID
- anomaly/normal badge
- asset/turbine ID
- event start/end
- event description

#### Event summary row

Show:

- event label
- prediction window size
- status distribution
- quality flags
- selected benchmark summary if available

#### Timeline section

Primary visualization area.

Show:

- time-series chart
- train vs prediction split
- anomaly event window
- status information
- anomaly flag overlays later

#### Feature inspection section

Allow the user to inspect selected Wind Farm A features.

Include:

- feature selector
- chart
- metadata panel
- raw vs cleaned view if needed

#### Event interpretation panel

Show deterministic backend-derived information such as:

- preprocessing notes
- quality warnings
- current model outputs
- benchmark notes

## 3. Benchmark Lab

### Purpose

Compare model runs within Wind Farm A.

### Layout

- run list or run selector
- leaderboard table
- score cards
- event-level result panel

### Main sections

#### Benchmark header

Show:

- run name
- run ID
- creation time
- models included
- score version note

#### Leaderboard

Columns:

- model name
- CARE score
- Coverage
- Accuracy
- Reliability
- Earliness

#### Event-level result panel

Allow the user to inspect:

- selected event
- event prediction result
- anomaly detection summary
- notes about current scoring logic

## 4. Dataset Explorer

### Purpose

Expose the Wind Farm A dataset structure in a controlled way.

### Main sections

- feature browser
- event catalog
- selected event sample view
- metadata summary

## Shared Components

The implementation should define reusable components for:

- summary cards
- anomaly/normal badges
- event list items
- leaderboard table
- score cards
- feature metadata panel
- timeline chart container
- assistant panel
- loading/empty/error states

## UX Priorities

### Highest priority

Make the Operations screen useful for one selected Wind Farm A event.

### Second priority

Make the Benchmark Lab understandable for one or more Wind Farm A runs.

### Lower priority

- advanced chart polish
- mobile optimization
- richer assistant behavior

## Stitch / Redesign Guidance

If redesigning the UI, the first screen should be:

- a Wind Farm A Operations dashboard

It should include:

- left event list
- top mode switch
- center event metadata and timeline
- bottom feature drilldown area
- right assistant placeholder

## Final Rule

The interface should be built so that:

- Wind Farm A scope is obvious
- the app is useful without live chat
- event detail is the core unit of analysis
- benchmark comparison stays within Wind Farm A
