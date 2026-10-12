
/* Student Project Tracker - API with Reliable Feedback */

// 1. Existing HTML elements
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

// 2. Temporary copy of server records
let projects = [];
let editingId = null;

// Request and loading state
let busy = false;
let loaded = false;

// 3. Display feedback in the existing message element
function showMessage(text) {
  message.textContent = text;
}

// 4. Update enabled/disabled controls
function updateControls() {
  nameInput.disabled = busy || !loaded;
  statusInput.disabled = busy || !loaded;
  saveButton.disabled = busy || !loaded;
  cancelButton.disabled = busy || !loaded;

  projectList.querySelectorAll('button').forEach(button => {
    button.disabled = busy || !loaded;
  });
}

// 5. Track pending operations
function setBusy(value) {
  busy = value;
  updateControls();
}

// 6. Make an API request and handle errors
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

  let data = null;

  // Read the response body if one exists
  const responseText = await response.text();

  if (responseText.trim() !== '') {
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      if (response.ok) {
        throw new Error(
          'The server returned invalid JSON.'
        );
      }

      throw new Error(
        `API request failed (HTTP ${response.status}).`
      );
    }
  }

  // Check HTTP status before treating the request as success
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

// 7. Restore the form to Add mode
function resetForm() {
  editingId = null;

  form.reset();
  nameInput.setCustomValidity('');

  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

// 8. Enter Edit mode
function editProject(id) {
  if (busy || !loaded) {
    return;
  }

  const project = projects.find(
    project => project.id === id
  );

  if (!project) {
    showMessage('Project not found. Reload the page.');
    return;
  }

  editingId = project.id;

  nameInput.value = project.name;
  statusInput.value = project.status;
  nameInput.setCustomValidity('');

  saveButton.textContent = 'Save changes';
  cancelButton.hidden = false;

  showMessage('Editing project. Save or Cancel your changes.');
  nameInput.focus();
}

// 9. Display the current project collection
function renderProjects() {
  projectList.replaceChildren();

  // Only a successful load can establish an empty state
  if (emptyState) {
    emptyState.hidden = !loaded || projects.length > 0;
  }

  projects.forEach(project => {
    const listItem = document.createElement('li');

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
    editButton.disabled = busy || !loaded;

    editButton.addEventListener('click', () => {
      editProject(project.id);
    });

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.disabled = busy || !loaded;

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

  updateControls();
}

// 10. Validate records returned by the API
function validateProjects(data) {
  if (!Array.isArray(data)) {
    throw new Error(
      'The API did not return a project list.'
    );
  }

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
    throw new Error(
      'The API returned duplicate project IDs.'
    );
  }

  return data;
}

// 11. Load projects from the server
async function loadProjects() {
  showMessage('Loading projects...');

  try {
    const data = await apiRequest('/api/projects');

    // Validate before replacing the displayed collection
    const currentProjects = validateProjects(data);

    projects = currentProjects;
    loaded = true;

    // Exit Edit mode if the record no longer exists
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
    // Keep the last successfully loaded list.
    // Never claim that a failed load means an empty database.
    if (!loaded) {
      projects = [];
    }

    renderProjects();

    showMessage(
      'Could not load projects: ' + error.message +
      (loaded
        ? ' The displayed list may be out of date.'
        : ' No project list is available.')
    );

    return false;
  }
}

// 12. Delete a project
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

  // No request is sent if confirmation is cancelled
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

    // The server confirmed deletion
    if (editingId === id) {
      resetForm();
    }

    showMessage('Deletion saved. Refreshing projects...');

    const refreshed = await loadProjects();

    if (refreshed) {
      showMessage('Project deleted successfully.');
    } else {
      showMessage(
        'Project deleted on the server, but the list ' +
        'could not be refreshed. Reload the page.'
      );
    }

  } catch (error) {
    showMessage('Delete failed: ' + error.message);

  } finally {
    // Always restore controls
    setBusy(false);
  }
}

// 13. One submit listener for Add and Edit
form.addEventListener('submit', async event => {
  event.preventDefault();

  // Prevent repeated submissions
  if (busy || !loaded) {
    return;
  }

  const name = nameInput.value.trim();
  const status = statusInput.value;

  // Validate the name
  if (name === '') {
    nameInput.setCustomValidity('Enter a project name.');
    nameInput.reportValidity();
    return;
  }

  const isEditing = editingId !== null;
  const selectedId = editingId;

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
      // Update an existing server record
      await apiRequest(`/api/projects/${selectedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

    } else {
      // Create a new server record
      await apiRequest('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });
    }

    // The mutation succeeded.
    // Reset only after the server confirms success.
    resetForm();

    showMessage('Changes saved. Refreshing projects...');

    const refreshed = await loadProjects();

    if (refreshed) {
      showMessage(
        isEditing
          ? 'Project updated successfully.'
          : 'Project added successfully.'
      );

      // Focus after controls are restored below
    } else {
      showMessage(
        'Project saved on the server, but the list ' +
        'could not be refreshed. Reload the page.'
      );
    }

  } catch (error) {
    // Preserve input and Edit mode after a failed mutation
    showMessage(
      (isEditing ? 'Update failed: ' : 'Add failed: ') +
      error.message +
      ' Your form values have been preserved.'
    );

  } finally {
    // Restore controls after success or failure
    setBusy(false);
  }
});

// 14. Cancel editing without contacting the API
cancelButton.addEventListener('click', () => {
  if (busy) {
    return;
  }

  resetForm();
  showMessage('Edit cancelled.');
  nameInput.focus();
});

// 15. Clear validation errors while typing
nameInput.addEventListener('input', () => {
  nameInput.setCustomValidity('');
});

// 16. Initialize the application
resetForm();

async function initialize() {
  setBusy(true);

  try {
    await loadProjects();
  } finally {
    setBusy(false);
  }
}

initialize();
