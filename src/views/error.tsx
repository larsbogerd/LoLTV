import type { Fmt } from '../format'
import { Layout } from './ui'

export function ErrorPage(props: { fmt: Fmt; title: string; message: string }) {
    return (
        <Layout fmt={props.fmt} title={props.title}>
            <h2 class="h">{props.title}</h2>
            <div class="empty">{props.message}</div>
        </Layout>
    )
}
