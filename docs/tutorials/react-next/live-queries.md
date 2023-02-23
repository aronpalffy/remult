# Live Queries :rocket:

::: tip New Feature
Live queries are a new feature introduced in version 0.18.
:::

Our todo list app can have multiple users using it at the same time. However, changes made by one user are not seen by others unless they manually refresh the browser.

Let's add realtime multiplayer capabilities to this app.

## Realtime updated todo list

Let's switch from fetching Tasks once when the React component is loaded, and manually maintaining state for CRUD operations, to using a realtime updated live query subscription **for both initial data fetching and subsequent state changes**.

1. Modify the contents of the `useEffect` hook in the `pages/index.tsx` file

```ts{4-5,10}
//src/pages/index.tsx

useEffect(() => {
  return taskRepo
    .liveQuery({
      limit: 20,
      orderBy: { completed: "asc" }
      //where: { completed: true },
    })
    .subscribe(info => setTasks(info.applyChanges))
}, [])
```

Let's review the change:

- Instead of calling the `repository`'s `find` method we now call the `liveQuery` method to define the query, and then call its `subscribe` method to establish a subscription which will update the Tasks state in realtime.
- The `subscribe` method accepts a callback with an `info` object that has 3 members:
  - `items` - an up to date list of items representing the current result - it's useful for readonly use cases.
  - `applyChanges` - a method that receives an array and applies the changes to it - we send that method to the `setTasks` state function, to apply the changes to the existing `tasks` state.
  - `changes` - a detailed list of changes that were received
- The `subscribe` method return an `unsubscribe` function which we use as a return value for the `useEffect` hook, so that it'll be called when the component unmounts.

2. As all relevant CRUD operations (made by all users) will **immediately update the component's state**, we should remove the manual adding of new Tasks to the component's state:

```ts{7}
//src/pages/index.tsx

const addTask = async (e: FormEvent) => {
  e.preventDefault()
  try {
    const newTask = await taskRepo.insert({ title: newTaskTitle })
    // setTasks([...tasks, newTask])   <-- this line is no longer needed
    setNewTaskTitle("")
  } catch (error: any) {
    alert(error.message)
  }
}
```

3. Optionally remove other redundant state changing code:

```tsx{11,17,26}
//src/pages/index.tsx

//...

{
  tasks.map(task => {
    const setTask = (value: Task) =>
      setTasks(tasks => tasks.map(t => (t === task ? value : t)))

    const setCompleted = async (completed: boolean) =>
      taskRepo.save({ ...task, completed })

    const setTitle = (title: string) => setTask({ ...task, title })

    const saveTask = async () => {
      try {
        await taskRepo.save(task)
      } catch (error: any) {
        alert(error.message)
      }
    }

    const deleteTask = async () => {
      try {
        await taskRepo.delete(task)
        // setTasks(tasks.filter(t => t !== task))
      } catch (error: any) {
        alert(error.message)
      }
    }

    //...
  })
}
```

Open the todo app in two (or more) browser windows/tabs, make some changes in one window and notice how the others are updated in realtime.

::: tip Under the hood
The default implementation of live-queries uses HTTP Server-Sent Events (SSE) to push realtime updates to clients, and stores live-query information in-memory.

For scalable production / serverless environments, live-query updates can be pushed using integration with third-party realtime providers, such as [Ably](https://ably.com/), and live-query information can be stored to any database supported by Remult.
:::