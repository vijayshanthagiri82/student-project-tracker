
/* Student Project Tracker - Express API and SQLite */

// 1. Find the existing HTML elements
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

// 2. Temporary display copy of API projects
let projects = [];

// Track the project currently being edited
let editingId = null;

// Track API activity
let busy = false;
let loaded = false;

// 3. Display messages
function showMessage(text) {
  message.textContent = text;
}

// 4. Enable or disable controls during requests
function setBusy(value) {
  busy = value;

  nameInput.disabled = busy;
  statusInput.disabled = busy;
  saveButton.disabled = busy || !loaded;
  cancelButton.disabled = busy;

  // Disable project action buttons
  projectList.querySelectorAll('button').forEach(button => {
    button.disabled = busy;
  });
}

// 5. Send a request and check the response
async function apiRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(
      'Network error. Cannot reach the server. ' +
      'Check that Express is running.'
    );
  }

  // Try to read the JSON response
  let data;

  try {
    data = await response.json();
  } catch (error) {
    if (!response.ok) {
      throw new Error(
        `API request failed (HTTP ${response.status}).`
      );
    }

    throw new Error('The server returned invalid JSON.');
  }

  // Handle HTTP errors from Express
  if (!response.ok) {
    const errorMessage =
      data &&
      typeof data.error === 'string'
        ? data.error
        : `API request failed (HTTP ${response.status}).`;

    throw new Error(errorMessage);
  }

  return data;
}

// 6. Reset the form to Add mode
function resetForm() {
  editingId = null;

  form.reset();
  nameInput.setCustomValidity('');

  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

// 7. Start editing an existing project
function editProject(id) {
  if (busy || !loaded) {
    return;
  }

  const project = projects.find(
    project => project.id === id
  );

  if (!project) {
    showMessage('Project not found. Reload the list.');
    return;
  }

  editingId = project.id;

  nameInput.value = project.name;
  statusInput.value = project.status;
  nameInput.setCustomValidity('');

  saveButton.textContent = 'Save changes';
  cancelButton.hidden = false;

  nameInput.focus();
}

// 8. Render the projects received from the API
function renderProjects() {
  projectList.replaceChildren();

  // A failed load is not an empty list
  if (emptyState) {
    emptyState.hidden = !loaded || projects.length > 0;
  }

  projects.forEach(project => {
    const listItem = document.createElement('li');

    // Display user-entered text safely
    const projectName = document.createElement('strong');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('p');
    projectStatus.textContent = 'Status: ' + project.status;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // Edit button
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.disabled = busy;

    editButton.addEventListener('click', () => {
      editProject(project.id);
    });

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.disabled = busy;

    deleteButton.addEventListener('click', () => {
      deleteProject(project.id);
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    listItem.appendChild(projectName);
    listItem.appendChild(projectStatus);
    listItem.appendChild(actions);

    projectList.appendChild(listItem);
  });
}

// 9. Load the current collection from Express
async function loadProjects() {
  showMessage('Loading projects...');

  try {
    const data = await apiRequest('/api/projects');

    // Verify the expected API response
    if (!Array.isArray(data)) {
      throw new Error(
        'The API did not return a project list.'
      );
    }

    // Validate records and server-generated IDs
    const valid = data.every(project =>
      project !== null &&
      typeof project === 'object' &&
      Number.isSafeInteger(project.id) &&
      project.id > 0 &&
      typeof project.name === 'string' &&
      typeof project.status === 'string' &&
      ['Planned', 'In Progress', 'Completed'].includes(
        project.status
      )
    );

    if (!valid) {
      throw new Error(
        'The API returned invalid project records.'
      );
    }

    const ids = data.map(project => project.id);

    if (new Set(ids).size !== ids.length) {
      throw new Error('The API returned duplicate IDs.');
    }

    // Replace the display copy with server records
    projects = data;
    loaded = true;

    // If an edited record no longer exists, exit Edit mode
    if (
      editingId !== null &&
      !projects.some(project => project.id === editingId)
    ) {
      resetForm();
    }

    renderProjects();

    if (projects.length === 0) {
      showMessage('No projects found. Add your first project.');
    } else {
      showMessage('Projects loaded successfully.');
    }

    return true;

  } catch (error) {
    // Do not interpret a failed load as an empty list
    loaded = false;
    projects = [];

    renderProjects();

    showMessage('Could not load projects: ' + error.message);
    return false;
  }
}

// 10. Delete a project through the API
async function deleteProject(id) {
  if (busy || !loaded) {
    return;
  }

  const project = projects.find(
    project => project.id === id
  );

  if (!project) {
    showMessage('Project not found.');
    return;
  }

  // Ask before sending a DELETE request
  const confirmed = window.confirm(
    `Are you sure you want to delete "${project.name}"?`
  );

  if (!confirmed) {
    return;
  }

  setBusy(true);
  showMessage('Deleting project...');

  try {
    await apiRequest(`/api/projects/${id}`, {
      method: 'DELETE'
    });

    // The deletion succeeded on the server
    if (editingId === id) {
      resetForm();
    }

    // Reload the authoritative API collection
    const refreshed = await loadProjects();

    if (refreshed) {
      showMessage('Project deleted successfully.');
    } else {
      showMessage(
        'Project deleted, but the list could not be refreshed. ' +
        'Reload the page to try again.'
      );
    }

  } catch (error) {
    showMessage('Delete failed: ' + error.message);
  } finally {
    setBusy(false);
  }
}

// 11. One form submit listener for Add and Edit
form.addEventListener('submit', async event => {
  event.preventDefault();

  if (busy || !loaded) {
    return;
  }

  const name = nameInput.value.trim();
  const status = statusInput.value;

  // Validate the submitted name
  if (name === '') {
    nameInput.setCustomValidity('Enter a project name.');
    nameInput.reportValidity();
    return;
  }

  const isEditing = editingId !== null;

  // Remember the selected ID before the request
  const selectedId = editingId;

  // Send only the values accepted by the API
  const projectData = {
    name: name,
    status: status
  };

  setBusy(true);

  showMessage(
    isEditing ? 'Saving changes...' : 'Adding project...'
  );

  try {
    if (isEditing) {
      // UPDATE: Use the existing server ID
      await apiRequest(`/api/projects/${selectedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

    } else {
      // CREATE: The server generates the project ID
      await apiRequest('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });
    }

    // Mutation succeeded; return to Add mode
    resetForm();

    // Reload the current collection from SQLite
    const refreshed = await loadProjects();

    if (refreshed) {
      showMessage(
        isEditing
          ? 'Project updated successfully.'
          : 'Project added successfully.'
      );

      nameInput.focus();
    } else {
      showMessage(
        'Project saved on the server, but the list ' +
        'could not be refreshed. Reload the page.'
      );
    }

  } catch (error) {
    // Do not reset unsaved input after a failed mutation
    showMessage(
      (isEditing ? 'Update failed: ' : 'Add failed: ') +
      error.message
    );
  } finally {
    setBusy(false);
  }
});

// 12. Cancel editing without sending an API request
cancelButton.addEventListener('click', () => {
  if (busy) {
    return;
  }

  resetForm();
  showMessage('Edit cancelled.');
  nameInput.focus();
});

// 13. Clear custom validation while typing
nameInput.addEventListener('input', () => {
  nameInput.setCustomValidity('');
});

// 14. Initialize the application
resetForm();

// Prevent mutations until the first API load succeeds
loaded = false;
setBusy(true);

async function initialize() {
  await loadProjects();
  setBusy(false);
}

initialize();
