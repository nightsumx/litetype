import { type Infer, number, string } from 'litetype'

const User = { name: string, email: string, city: string, age: number }
export type User = Infer<typeof User>
