# image-prompt-management Specification

## Purpose
TBD - created by archiving change add-image-prompt-management. Update Purpose after archive.
## Requirements
### Requirement: Title bar provides direct access to prompt management
The system SHALL place a dedicated prompt management button next to the settings button in the title bar. Clicking this button MUST open a dedicated prompt management dialog instead of routing through a settings category.

#### Scenario: Open prompt management from the title bar
- **WHEN** the user clicks the prompt management button in the title bar
- **THEN** the system opens the prompt management dialog
- **AND** the settings dialog remains closed unless the user explicitly opens it separately

### Requirement: User can manage reusable image prompt templates
The system SHALL provide a persistent prompt template library for image generation, where each template contains a title and prompt content. Users MUST be able to add, edit, and delete templates from the dedicated prompt management dialog, and the system MUST block saving templates with empty titles, empty content, or duplicate normalized titles.

#### Scenario: Save a valid prompt template
- **WHEN** the user opens prompt management, creates or edits a template with a non-empty title and non-empty prompt content, and clicks save
- **THEN** the system saves the template to persistent user settings
- **AND** the prompt management list refreshes immediately to show the latest saved content

#### Scenario: Reject an invalid template draft
- **WHEN** the user attempts to save a template with an empty title, empty prompt content, or a title that duplicates an existing template after trimming
- **THEN** the system MUST reject the save
- **AND** the current edit dialog MUST remain open so the user can fix the draft

#### Scenario: Delete a saved prompt template
- **WHEN** the user clicks delete for a saved template and confirms the deletion
- **THEN** the system removes that template from persistent user settings
- **AND** the template no longer appears in the prompt management list

### Requirement: AI image nodes show saved prompt template shortcuts
The system SHALL render saved prompt template titles as clickable shortcut chips in the `AI 图片` node above the prompt editor when at least one template exists. The shortcut area MUST preserve the saved order of templates, wrap into at most two visible rows, and use internal scrolling when the content exceeds that height.

#### Scenario: Show prompt shortcuts for configured templates
- **WHEN** the user has one or more saved prompt templates and opens an `AI 图片` node
- **THEN** the node shows one clickable shortcut chip per saved template above the prompt text area
- **AND** each chip label matches the saved template title

#### Scenario: Hide shortcut area when there are no templates
- **WHEN** the user has not configured any prompt templates
- **THEN** the `AI 图片` node MUST NOT show an empty prompt shortcut section

### Requirement: Clicking a prompt shortcut appends the template content to the current node prompt
The system SHALL apply the clicked template content to the current `AI 图片` node prompt while keeping the visible textarea state and underlying node data synchronized. If the current prompt already contains content, the system MUST insert one blank line before appending the template content.

#### Scenario: Apply a template to an empty prompt
- **WHEN** the current `AI 图片` node prompt is empty and the user clicks a saved prompt shortcut
- **THEN** the prompt textarea shows the template content
- **AND** the node's persisted prompt data is updated to the same content

#### Scenario: Apply a template to a non-empty prompt
- **WHEN** the current `AI 图片` node already contains prompt text and the user clicks a saved prompt shortcut
- **THEN** the system appends the template content to the end of the current prompt
- **AND** the existing prompt text and the appended template content are separated by a blank line
- **AND** the model selection, aspect ratio, reference image state, and other node parameters remain unchanged
